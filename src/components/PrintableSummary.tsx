import React from 'react';
import { useTrip } from '../context/TripContext';

export const PrintableSummary: React.FC = () => {
  const { bookings, itineraries, totalPlannedINR, totalBookedINR, totalVarianceINR } = useTrip();

  return (
    <div className="hidden print:block text-black bg-white p-6 font-sans text-xs space-y-4">
      {/* Print Header */}
      <div className="border-b-2 border-black pb-3 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-tight">Europe Winter Trip 2027</h1>
          <p className="text-sm font-semibold">Travel Handbook, Bookings & Emergency Cancellation Guide</p>
          <p className="text-xs text-gray-600">Dates: 06 Feb 2027 – 17 Feb 2027 • Route: HYD → CDG → ZRH → RVN → HEL → HYD</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold">Planned Budget: ₹{totalPlannedINR.toLocaleString('en-IN')}</p>
          <p className="text-xs font-bold">Booked Total: ₹{totalBookedINR.toLocaleString('en-IN')}</p>
          <p className="text-xs font-bold">
            Variance: {totalVarianceINR <= 0 ? `-₹${Math.abs(totalVarianceINR).toLocaleString('en-IN')} (Saved)` : `+₹${totalVarianceINR.toLocaleString('en-IN')} (Over)`}
          </p>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="border border-gray-400 p-2.5 rounded bg-gray-50">
        <h2 className="font-bold text-xs uppercase mb-1">🚨 Emergency Assistance & Helpline Numbers</h2>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div><strong>Europe Emergency:</strong> 112 (Police / Medical)</div>
          <div><strong>Etihad Airways:</strong> +91 1800 123 3842</div>
          <div><strong>Finnair Finland:</strong> +358 9 818 0800</div>
          <div><strong>SNCF / TGV France:</strong> +33 1 84 94 36 35</div>
          <div><strong>SBB Swiss Rail:</strong> +41 51 220 11 11</div>
          <div><strong>VFS Helpline:</strong> +91 22 6786 6014</div>
        </div>
      </div>

      {/* Master Booking & Cancellation Matrix */}
      <div>
        <h2 className="font-bold text-xs uppercase mb-1.5 border-b border-gray-300 pb-0.5">
          1. Master Bookings & Cancellation Cutoff Matrix
        </h2>
        <table className="w-full border-collapse border border-gray-300 text-[10px]">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-300 p-1 text-left">Date</th>
              <th className="border border-gray-300 p-1 text-left">Item / Provider</th>
              <th className="border border-gray-300 p-1 text-left">PNR / Ref</th>
              <th className="border border-gray-300 p-1 text-right">Planned (₹)</th>
              <th className="border border-gray-300 p-1 text-right">Booked (₹)</th>
              <th className="border border-gray-300 p-1 text-left">Free Cancellation Cutoff</th>
              <th className="border border-gray-300 p-1 text-left">Policy Summary</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.id} className="border-b border-gray-200">
                <td className="border border-gray-300 p-1 whitespace-nowrap">{b.date}</td>
                <td className="border border-gray-300 p-1 font-semibold">
                  {b.title} <span className="text-gray-500 font-normal">({b.provider})</span>
                </td>
                <td className="border border-gray-300 p-1 font-mono">{b.confirmationNumber || 'Pending'}</td>
                <td className="border border-gray-300 p-1 text-right">₹{b.plannedCostINR.toLocaleString('en-IN')}</td>
                <td className="border border-gray-300 p-1 text-right">
                  {b.bookedCostINR !== null ? `₹${b.bookedCostINR.toLocaleString('en-IN')}` : '—'}
                </td>
                <td className="border border-gray-300 p-1 font-semibold">
                  {b.bookingStatus === 'not_booked'
                    ? 'To Book'
                    : b.cancellationDeadline
                      ? new Date(b.cancellationDeadline).toLocaleDateString('en-GB')
                      : (b.isRefundable ? 'Flexible' : 'Non-refundable')}
                </td>
                <td className="border border-gray-300 p-1 text-gray-700">
                  {b.bookingStatus === 'not_booked' ? 'Not booked yet' : b.refundPolicy}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Day by Day Quick Itinerary */}
      <div className="pt-2">
        <h2 className="font-bold text-xs uppercase mb-1.5 border-b border-gray-300 pb-0.5">
          2. Day-by-Day Travel Handbook (Feb 6 – Feb 17)
        </h2>
        <div className="space-y-1.5">
          {itineraries.map(day => (
            <div key={day.dayNumber} className="border-b border-gray-200 pb-1">
              <span className="font-bold text-[10px] uppercase">
                Day {day.dayNumber} ({day.date} - {day.dayName}): {day.title}
              </span>
              <p className="text-[10px] text-gray-700">
                {day.highlights.join(' • ')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

