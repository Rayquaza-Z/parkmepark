/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import OwnerForm from './components/OwnerForm';
import DriverForm from './components/DriverForm';
import LoginPhone from './pages/LoginPhone';
import ThankYou from './pages/ThankYou';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPhone />} />
        <Route path="/owner" element={<OwnerForm />} />
        <Route path="/driver" element={<DriverForm />} />
        <Route path="/thank-you" element={<ThankYou />} />
      </Routes>
    </BrowserRouter>
  );
}
