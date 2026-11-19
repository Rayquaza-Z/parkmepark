import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AREA_CONFIG, City, AreaKey } from '../config/areas';
import { isGoogleMapsUrl } from '../utils/validation';
import firebaseClient from '../firebaseClient';
import { useTranslation } from 'react-i18next';

const OwnerForm: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = i18n.language as 'en' | 'hi' | 'mr';
  const location = useLocation();
  const source = new URLSearchParams(location.search).get('src') ?? '';

  const [city, setCity] = useState<City>('Mumbai');
  const [area, setArea] = useState<AreaKey>('colaba');
  const [locationLink, setLocationLink] = useState('');
  const [priceInfo, setPriceInfo] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset area when city changes
  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCity = e.target.value as City;
    setCity(newCity);
    setArea('' as AreaKey);
    setErrors(prev => ({ ...prev, area: '' }));
  };

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setArea(e.target.value as AreaKey);
  };

  // Compute price line / not‑confirmed message
  useEffect(() => {
    if (!city || !area) { setPriceInfo(''); return; }
    const cfg = AREA_CONFIG[city][area];
    if (!cfg?.price) {
      const msg = {
        en: "Pricing for this area is not yet confirmed. Submit your request and we will tell you the price on WhatsApp.",
        hi: "इस क्षेत्र की कीमत अभी तय नहीं हुई है। अपना अनुरोध भेजें, हम व्हाट्सऐप पर कीमत बताएंगे।",
        mr: "या भागाची किंमत अजून निश्चित नाही. विनंती सबमिट करा, व्हॉट्सअॅपवर किंमत कळवू."
      }[language];
      setPriceInfo(msg);
      return;
    }
    // Existing price logic – placeholder (replace with your real logic)
    const price = cfg.price.car?.day ?? cfg.price.twoWheeler?.month;
    setPriceInfo(`${price} INR per day`);
  }, [city, area, language]);

  const validateLocationLink = (value: string): string => {
    if (!value) return t('locationLinkRequired');
    if (!isGoogleMapsUrl(value)) return t('locationLinkInvalid');
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    const linkError = validateLocationLink(locationLink);
    if (linkError) newErrors.locationLink = linkError;
    // Add any other field validations here …
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    const payload = {
      city,
      area_key: area,
      source,
      language,
      location_link: locationLink,
      // keep other existing fields from your original form (e.g., name, vehicle, etc.)
    };
    await firebaseClient.addOwnerListing(payload);
    // navigate to thank‑you page (implementation depends on your router)
  };

  return (
    <form onSubmit={handleSubmit} className="owner-form">
      {/* City selector */}
      <label htmlFor="city-select">{t('city')}</label>
      <select id="city-select" value={city} onChange={handleCityChange} required>
        <option value="Mumbai">{t('cityMumbai')}</option>
        <option value="Pune">{t('cityPune')}</option>
      </select>

      {/* Area selector */}
      <label htmlFor="area-select">{t('area')}</label>
      <select id="area-select" value={area} onChange={handleAreaChange} required>
        {Object.entries(AREA_CONFIG[city]).map(([key, cfg]) => (
          <option key={key} value={key}>{cfg.name[language]}</option>
        ))}
        <option value="somewhere_else">{t('somewhereElse')}</option>
      </select>

      {/* Price / not‑confirmed line */}
      {priceInfo && <div className="price-info">{priceInfo}</div>}

      {/* New mandatory Location link field */}
      <label htmlFor="locationLink">{t('locationLinkLabel')}</label>
      <input
        id="locationLink"
        type="url"
        placeholder={t('locationLinkPlaceholder')}
        value={locationLink}
        onChange={e => setLocationLink(e.target.value)}
        required
      />
      {errors.locationLink && <div className="error">{errors.locationLink}</div>}
      <small>{t('locationLinkHelper')}</small>

      {/* Existing fields from your original form should be placed here */}
      {/* ... */}

      <button type="submit" className="button-primary">{t('submit')}</button>
    </form>
  );
};

export default OwnerForm;
