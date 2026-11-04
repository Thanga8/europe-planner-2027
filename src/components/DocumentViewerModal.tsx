import React from 'react';
import { X, Download, FileCheck } from 'lucide-react';
import { EncryptedDocumentAttachment } from '../types';

interface DocumentViewerModalProps {
  attachment: EncryptedDocumentAttachment | null;
  onClose: () => void;
  titlePrefix?: string;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  attachment,
  onClose,
  titlePrefix = 'Document'
}) => {
  if (!attachment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 sm:p-5 animate-in fade-in">
      <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-2xl max-h-[92vh] overflow-hidden p-6 sm:p-7 text-slate-800 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-2.5 truncate">
            <FileCheck className="w-5 h-5 text-sky-600 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">
                {titlePrefix}
              </span>
              <h3 className="text-sm font-black text-slate-900 truncate">
                {attachment.fileName}
              </h3>
              <span className="text-[10px] text-slate-500 block">
                {(attachment.fileSize / 1024).toFixed(1)} KB • Stored locally
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <a
              href={attachment.dataBase64}
              download={attachment.fileName}
              className="p-2 rounded-xl glass-subcard hover:bg-white text-sky-800 transition active:scale-95"
              title="Download File"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 bg-white/70"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto py-4 min-h-[350px] flex items-center justify-center bg-slate-100/50 rounded-2xl mt-4">
          {attachment.fileType === 'application/pdf' || attachment.fileName.toLowerCase().endsWith('.pdf') ? (
            <iframe
              src={attachment.dataBase64}
              title={attachment.fileName}
              className="w-full h-[65vh] rounded-2xl border border-slate-200"
            />
          ) : (
            <img
              src={attachment.dataBase64}
              alt={attachment.fileName}
              className="max-h-[65vh] max-w-full object-contain rounded-2xl shadow-sm"
            />
          )}
        </div>

        <div className="pt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl glass-subcard hover:bg-white text-slate-800 font-bold text-xs"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};

