/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import BananaLoader from './BananaLoader';

const LoadingOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <BananaLoader className="w-72 h-72" />
    </div>
  );
};

export default LoadingOverlay;