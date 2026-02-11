import React from 'react';
import { CheckCircle2, Download, Home } from 'lucide-react';
import { formatCurrency, formatMembershipYear, formatDateTime } from '../utils/helpers';

const PaymentSuccess = ({ paymentData, onReset }) => {
  const handleDownloadReceipt = () => {
    const payment = paymentData?.payment || {};
    const member = paymentData?.member || {};
    const activatedYears = paymentData?.activatedYears || [];
    const paymentDate = payment.date ? new Date(payment.date).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric'
    }) : new Date().toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const paymentTime = payment.date ? new Date(payment.date).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit'
    }) : new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit'
    });

    const yearsHtml = activatedYears.map(year => {
      const start = new Date(year.start).getFullYear();
      const end = new Date(year.end).getFullYear();
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">Apr ${start} - Mar ${end}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">Paid</td></tr>`;
    }).join('');

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Receipt - ${payment.id || ''}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; padding: 40px; background: #fff; }
          .receipt { max-width: 600px; margin: 0 auto; border: 2px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { font-size: 22px; margin-bottom: 4px; }
          .header p { font-size: 13px; opacity: 0.9; }
          .success-badge { background: #dcfce7; color: #166534; display: inline-block; padding: 6px 20px; border-radius: 20px; font-weight: 600; font-size: 14px; margin: 20px 0 0; }
          .body { padding: 30px; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; border-bottom: 2px solid #f3f4f6; padding-bottom: 6px; }
          .detail-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
          .detail-row .label { color: #6b7280; }
          .detail-row .value { font-weight: 600; color: #1f2937; }
          .amount-box { background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0; }
          .amount-box .amount { font-size: 28px; font-weight: 700; color: #166534; }
          .amount-box .label { font-size: 12px; color: #4ade80; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          table th { background: #f9fafb; padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb; }
          table th:last-child { text-align: right; }
          .footer { background: #f9fafb; padding: 20px 30px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
          .footer p { margin: 4px 0; }
          @media print {
            body { padding: 0; }
            .receipt { border: none; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>Membership Payment Receipt</h1>
            <p>Indian Chartered Accountants Association</p>
            <div class="success-badge">Payment Successful</div>
          </div>
          <div class="body">
            <div class="section">
              <div class="section-title">Transaction Details</div>
              <div class="detail-row">
                <span class="label">Transaction ID</span>
                <span class="value">${payment.id || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Date</span>
                <span class="value">${paymentDate}</span>
              </div>
              <div class="detail-row">
                <span class="label">Time</span>
                <span class="value">${paymentTime}</span>
              </div>
              <div class="detail-row">
                <span class="label">Payment Method</span>
                <span class="value" style="text-transform:capitalize;">${payment.method || 'Online'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Status</span>
                <span class="value" style="color:#166534;">${payment.status || 'Success'}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Member Information</div>
              <div class="detail-row">
                <span class="label">Name</span>
                <span class="value">${member.name || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Folio Number</span>
                <span class="value">${member.folio_number || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Email</span>
                <span class="value">${member.email || 'N/A'}</span>
              </div>
            </div>

            ${activatedYears.length > 0 ? `
            <div class="section">
              <div class="section-title">Activated Membership Years</div>
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${yearsHtml}
                </tbody>
              </table>
            </div>
            ` : ''}

            <div class="amount-box">
              <div class="amount">${formatCurrency(payment.amount)}</div>
              <div class="label">Total Amount Paid</div>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Sunsys Technologies Pvt Ltd. All rights reserved.</p>
            <p>This is a computer-generated receipt and does not require a signature.</p>
          </div>
        </div>

        <div class="no-print" style="text-align:center;margin-top:24px;">
          <button onclick="window.print()" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
            Print / Save as PDF
          </button>
        </div>
      </body>
      </html>
    `;

    const receiptWindow = window.open('', '_blank');
    if (receiptWindow) {
      receiptWindow.document.write(receiptHtml);
      receiptWindow.document.close();
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mx-auto mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Successful!
          </h2>
          <p className="text-gray-600">
            Your membership has been activated successfully
          </p>
        </div>

        <div className="space-y-6">
          {/* Payment Details */}
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Payment Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Transaction ID</p>
                <p className="font-medium text-gray-900 break-all">
                  {paymentData?.payment?.id}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Amount Paid</p>
                <p className="font-semibold text-gray-900 text-lg">
                  {formatCurrency(paymentData?.payment?.amount)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Payment Method</p>
                <p className="font-medium text-gray-900 capitalize">
                  {paymentData?.payment?.method || 'Online'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Status</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {paymentData?.payment?.status || 'Success'}
                </span>
              </div>
            </div>
          </div>

          {/* Member Details */}
          {paymentData?.member && (
            <div className="p-6 bg-primary-50 rounded-xl border border-primary-200">
              <h3 className="text-sm font-medium text-primary-900 mb-4">Member Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary-700">Name:</span>
                  <span className="font-medium text-primary-900">{paymentData.member.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-700">Folio Number:</span>
                  <span className="font-medium text-primary-900">{paymentData.member.folio_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-700">Email:</span>
                  <span className="font-medium text-primary-900">{paymentData.member.email}</span>
                </div>
              </div>
            </div>
          )}

          {/* Activated Years */}
          {paymentData?.activatedYears && paymentData.activatedYears.length > 0 && (
            <div className="p-6 bg-green-50 rounded-xl border border-green-200">
              <h3 className="text-sm font-medium text-green-900 mb-4">
                Activated Membership Years
              </h3>
              <div className="space-y-2">
                {paymentData.activatedYears.map((year, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-white rounded-lg"
                  >
                    <span className="font-medium text-gray-900">
                      {formatMembershipYear(year.start, year.end)}
                    </span>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={handleDownloadReceipt}
              className="btn-secondary flex-1 flex items-center justify-center space-x-2"
            >
              <Download className="w-5 h-5" />
              <span>Download Receipt</span>
            </button>
            <button
              onClick={onReset}
              className="btn-primary flex-1 flex items-center justify-center space-x-2"
            >
              <Home className="w-5 h-5" />
              <span>Back to Home</span>
            </button>
          </div>

          <div className="pt-4 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              A confirmation email has been sent to your registered email address.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
