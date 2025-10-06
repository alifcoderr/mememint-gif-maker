/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { XCircleIcon } from './icons';
import { EditTool } from '../types';

interface ComingSoonModalProps {
  tool: EditTool | null;
  onClose: () => void;
}

const ComingSoonModal: React.FC<ComingSoonModalProps> = ({ tool, onClose }) => {
  if (!tool) return null;

  const toolName = tool.charAt(0).toUpperCase() + tool.slice(1);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg p-8 shadow-2xl max-w-sm w-full mx-4 border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold text-white mb-4">Feature Coming Soon!</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors -mt-2 -mr-2">
                <XCircleIcon className="w-8 h-8" />
            </button>
        </div>
        <p className="text-slate-300 mb-6">
          The "{toolName}" functionality is currently under development. Please check back later for updates.
        </p>
        <div className="flex justify-end">
          <button onClick={onClose} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-500 transition-colors">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonModal;
