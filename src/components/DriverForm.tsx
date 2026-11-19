import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AREA_CONFIG, City, AreaKey } from '../config/areas';
import firebaseClient from '../firebaseClient';
import { useTranslation } from 'react-i18next';

const DriverForm: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = i18n.language as 'en' | 'hi' | 'mr';
  const location = useLocation();
  const source = new URLSearchParams(location.search).get('src') ?? '';

  const [city, setCity] = useState<City>('Mumbai');
  const [area, setArea] = useState<AreaKey>('colaba');
  const [cancellationAccepted, setCancellationAccepted] = useState(false);
  const [priceInfo, setPriceInfo] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCity = e.target.value as City;
    setCity(newCity);
    setArea('' as AreaKey);
    setErrors(prev => ({ ...prev, area: '' }));
  };

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setArea(e.target.value as AreaKey);
  };

  // Price line / not‑confirmed message
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
    const price = cfg.price.car?.day ?? cfg.price.twoWheeler?.month;
    setPriceInfo(`${price} INR per day`);
  }, [city, area, language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellationAccepted) {
      setErrors(prev => ({ ...prev, cancellation: t('cancellationRequired') }));
      return;
    }
    const CANCELLATION_HOURS = Number(process.env.CANCELLATION_HOURS ?? '24');
    const startDate = new Date(); // replace with actual start‑date field value
    const cancellationDeadline = new Date(startDate.getTime() - CANCELLATION_HOURS * 3600 * 1000);
    const payload = {
      city,
      area_key: area,
      source,
      language,
      cancellation_policy_accepted: true,
      cancellation_deadline: cancellationDeadline.toISOString(),
      // Add the rest of the driver fields (vehicle, contact, etc.)
    };
    await firebaseClient.addDriverRequest(payload);
    // navigate to thank‑you page after successful submit
  };

  return (
    <form onSubmit={handleSubmit} className="driver-form">
      {/* City selector */}
      <label htmlFor="city-select">{t('city')}</label>
      <select id="city-select" value={city} onChange={handleCityChange} required>
        <option value="Mumbai">{t('cityMumbai')}</option>
        <option value="Pune">{t('cityPune')}</option>
      </select>

      {/* Area selector */}
      <label htmlFor="area-select">{t('area')}</label>
      <select id="area-select" value={area} onChange={handleAreaChange} required>
        {Object.entries(AREA_CONFIG[city]).map(([k, cfg]) => (
          <option key={k} value={k}>{cfg.name[language]}</option>
        ))}
        <option value="somewhere_else">{t('somewhereElse')}</option>
      </select>

      {/* Price / not‑confirmed line */}
      {priceInfo && <div className="price-info">{priceInfo}</div>}

      {/* Cancellation rule text */}
      <div className="cancellation-rule">
        {t('cancellationText', { hours: process.env.CANCELLATION_HOURS ?? '24', rule: t('refundRule') })}
      </div>
      <label>
        <input
          type="checkbox"
          checked={cancellationAccepted}
          onChange={e => setCancellationAccepted(e.target.checked)}
          required
        />
        {t('cancellationCheckbox')}
      </label>
      {errors.cancellation && <div className="error">{errors.cancellation}</div>}

      {/* Existing driver fields (vehicle, date, contact, etc.) should be placed here */}

      <button type="submit" className="button-primary">{t('submit')}</button>
    </form>
  );
};

export default DriverForm;
