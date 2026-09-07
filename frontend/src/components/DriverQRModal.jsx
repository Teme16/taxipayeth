import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, QrCode, Download } from 'lucide-react';

export default function DriverQRModal({
  driverName,
  driverId,
  userId,
  targaNo,
  tariffPerSeat = 15,
  onClose
}) {
  const qrRef = useRef(null);

  // Dynamic QR payload containing unique driver details
  const qrPayload = JSON.stringify({
    driverName: driverName || 'Driver',
    driverId: driverId || 'DRV-UNKNOWN',
    userId: userId || '',
    targaNo: targaNo || 'UNREGISTERED',
    tariffPerSeat: tariffPerSeat
  });

  const downloadQR = () => {
    if (!qrRef.current) return;
    const svgElement = qrRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 25, 25, 250, 250);

      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `TaxiPay_QR_${targaNo || 'Driver'}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-sm flex flex-col items-center relative text-white shadow-2xl">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-gray-400 hover:text-white bg-neutral-800 p-2 rounded-full transition cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-1 text-taxi-blue-primary">
          <QrCode size={24} />
          <h3 className="text-xl font-black text-white">Minibus Fare QR</h3>
        </div>
        <p className="text-xs text-gray-400 mb-6 font-mono bg-neutral-800 px-3 py-1 rounded-full border border-neutral-700">
          PLATE: {targaNo}
        </p>

        {/* Dynamic Unique QR Code Box */}
        <div
          ref={qrRef}
          className="bg-white p-4 rounded-2xl shadow-xl mb-6 flex items-center justify-center w-[230px] h-[230px]"
        >
          <QRCodeSVG
            value={qrPayload}
            size={200}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="H"
            includeMargin={false}
          />
        </div>

        <p className="text-xs text-gray-400 text-center mb-6">
          Unique QR Code for <span className="text-white font-bold">{driverName}</span>. Passengers scan this to pay.
        </p>

        <button
          onClick={downloadQR}
          type="button"
          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3 rounded-xl transition text-xs flex items-center justify-center gap-2 border border-neutral-700 cursor-pointer"
        >
          <Download size={16} />
          Download PNG for Printing
        </button>
      </div>
    </div>
  );
}