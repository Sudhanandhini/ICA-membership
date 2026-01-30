# Membership Payment System - Backend

Backend API for the Membership Payment System built with Node.js, Express, and MySQL.

## Technology Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MySQL** - Database
- **Razorpay** - Payment gateway
- **Nodemailer** - Email notifications

## Features

- ✅ Member search and verification
- ✅ Sequential payment validation
- ✅ Razorpay payment integration
- ✅ Payment history tracking
- ✅ Automatic membership activation
- ✅ RESTful API endpoints

## Installation

### Prerequisites

- Node.js (v16 or higher)
- MySQL (v8 or higher)
- Razorpay account (for payment integration)

### Setup Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file with your configuration:
   - Database credentials
   - Razorpay API keys
   - Email configuration (optional)

3. **Create database and tables:**
   ```bash
   mysql -u root -p < database/schema.sql
   ```
   This will:
   - Create the `membership_payment_db` database
   - Create `members` and `membership_payments` tables
   - Insert sample data for testing

4. **Start the server:**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

The server will start on `http://localhost:5000`

## API Endpoints

### Members

#### Search Members
```http
POST /api/members/search
Content-Type: application/json

{
  "name": "Rajesh"
}
```

#### Get Member by ID
```http
GET /api/members/:id
```

#### Get Member by Folio Number
```http
GET /api/members/folio/:folioNumber
```

### Payments

#### Get Payment History
```http
GET /api/payments/history/:memberId
```

#### Calculate Payable Years
```http
POST /api/payments/calculate
Content-Type: application/json

{
  "memberId": 1
}
```

#### Initiate Payment
```http
POST /api/payments/initiate
Content-Type: application/json

{
  "memberId": 1,
  "payableYears": [...],
  "totalAmount": 2400
}
```

#### Verify Payment
```http
POST /api/payments/verify
Content-Type: application/json

{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx"
}
```

#### Get Membership Status
```http
GET /api/payments/status/:memberId
```

## Payment Logic

### Sequential Year Rule

The system enforces a critical rule: **Members cannot skip membership years**.

**Examples:**

1. **First-time member:**
   - Assigns current year (Apr 2025 - Mar 2026)
   - Amount: ₹1,200

2. **Member with gap:**
   - Last paid: 2023-24
   - Skipped: 2024-25
   - Must pay: 2024-25, 2025-26 (sequential)
   - Amount: ₹2,400

3. **All paid up:**
   - Shows "All years up to date"
   - Can pay for next year when available

## Database Schema

### Members Table
```sql
id, name, phone, email, folio_number, created_at
```

### Membership_Payments Table
```sql
id, member_id, membership_year_start, membership_year_end,
amount, payment_status, payment_date, transaction_id,
razorpay_order_id, razorpay_payment_id, razorpay_signature
```

## Testing

Sample members are included in the database:
- Rajesh Kumar (FOL001) - Paid 2022-23, 2023-24
- Priya Sharma (FOL002) - All years paid
- Amit Patel (FOL003) - No payments (first-time)
- Sneha Gupta (FOL004) - Only 2023-24 paid
- Vikram Singh (FOL005) - Only 2024-25 paid

## Environment Variables

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=membership_payment_db
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
FRONTEND_URL=http://localhost:5173
```

## Error Handling

The API returns consistent error responses:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Technical details (dev mode only)"
}
```

## Security

- Environment variables for sensitive data
- CORS configuration
- Payment signature verification
- SQL injection prevention (parameterized queries)
- Input validation

## Support

For issues or questions, contact Sunsys Technologies Pvt Ltd.

---

**Developed by Sunsys Technologies Pvt Ltd**
