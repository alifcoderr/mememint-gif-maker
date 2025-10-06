/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';

const BananaLoader: React.FC<{ className?: string }> = ({ className }) => {
  const loaderSrc = 'https://www.gstatic.com/aistudio/starter-apps/bananimate/bananaloader2.gif';

  return (
    <img src={loaderSrc} className={className} alt="Loading animation..." />
  );
};

export default BananaLoader;