import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeViewProps {
  value: string;
  size?: number;
  className?: string;
  darkColor?: string;
  lightColor?: string;
}

export const QRCodeView: React.FC<QRCodeViewProps> = ({
  value,
  size = 180,
  className = '',
  darkColor = '#000000',
  lightColor = '#ffffff',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 1,
        color: {
          dark: darkColor,
          light: lightColor,
        },
      }).catch(err => {
        console.error('Error generating QR code', err);
      });
    }
  }, [value, size, darkColor, lightColor]);

  return (
    <div className={`flex flex-col items-center justify-center p-2 bg-white rounded-xl shadow-inner ${className}`}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
      <span className="text-[10px] font-mono text-slate-500 tracking-wider mt-1 truncate max-w-[200px]">
        {value}
      </span>
    </div>
  );
};

