# Membership Payment System - Frontend

Modern React-based frontend for the Membership Payment System with responsive design and seamless payment integration.

## Technology Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client
- **Lucide React** - Icon library
- **Razorpay** - Payment gateway integration

## Features

- ✅ Responsive design for all devices
- ✅ Real-time member search
- ✅ Interactive payment calculation
- ✅ Razorpay payment integration
- ✅ Sequential year validation display
- ✅ Payment success confirmation
- ✅ Clean and modern UI

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Setup Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build
   ```
   The production build will be in the `dist` folder.

5. **Preview production build:**
   ```bash
   npm run preview
   ```

## Project Structure

```
frontend/
├── src/
│   ├── components/        # React components
│   │   ├── Header.jsx
│   │   ├── MemberSearch.jsx
│   │   ├── MemberDetails.jsx
│   │   ├── PaymentCalculation.jsx
│   │   ├── PaymentSuccess.jsx
│   │   └── Loading.jsx
│   ├── services/          # API services
│   │   └── api.js
│   ├── utils/             # Helper functions
│   │   └── helpers.js
│   ├── App.jsx            # Main app component
│   ├── main.jsx           # Entry point
│   └── index.css          # Global styles
├── index.html             # HTML template
├── package.json           # Dependencies
├── vite.config.js         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── postcss.config.js      # PostCSS configuration
```

## Component Flow

### 1. MemberSearch
- Allows users to search for members by name
- Displays search results
- Handles member selection

### 2. MemberDetails
- Shows complete member information
- Displays Folio number, phone, email
- Verified member indicator

### 3. PaymentCalculation
- Fetches payment history
- Calculates payable years using sequential logic
- Displays total amount
- Shows gap warnings if years are skipped
- Proceeds to payment

### 4. PaymentSuccess
- Displays successful payment details
- Shows transaction ID and amount
- Lists activated membership years
- Download receipt option (placeholder)

## User Flow

```
Search Member → Select Member → View Calculation → Make Payment → Success Screen
      ↓              ↓                 ↓                ↓              ↓
  API Call      Display Info     Calculate Years   Razorpay      Verify
```

## API Integration

All API calls are handled through `src/services/api.js`:

- `memberAPI.search(name)` - Search members
- `memberAPI.getById(id)` - Get member details
- `paymentAPI.calculate(memberId)` - Calculate payment
- `paymentAPI.initiate(data)` - Initiate payment
- `paymentAPI.verify(data)` - Verify payment

## Styling

The app uses Tailwind CSS with custom configurations:

- **Primary Color:** Blue (#0284c7)
- **Font Family:** Inter
- **Custom Components:** Defined in `index.css`
  - `.btn-primary` - Primary button style
  - `.btn-secondary` - Secondary button style
  - `.input-field` - Input field style
  - `.card` - Card container style

## Razorpay Integration

Payment processing is handled via Razorpay:

1. Load Razorpay script dynamically
2. Create order on backend
3. Open Razorpay checkout modal
4. Handle payment response
5. Verify payment on backend
6. Show success/failure

## Responsive Design

The application is fully responsive:

- **Mobile:** Single column layout
- **Tablet:** Grid layout with stacking
- **Desktop:** Two-column layout

## Error Handling

- API errors are caught and displayed
- User-friendly error messages
- Loading states for async operations
- Payment failure handling

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

### Hot Module Replacement (HMR)
Vite provides instant HMR during development for a smooth developer experience.

### Code Organization
- Components are modular and reusable
- Services handle all API calls
- Utils contain helper functions
- Consistent naming conventions

## Production Deployment

1. Build the app:
   ```bash
   npm run build
   ```

2. Deploy the `dist` folder to your hosting service:
   - Vercel
   - Netlify
   - AWS S3 + CloudFront
   - Any static hosting

3. Configure environment variables on your hosting platform

## Environment Variables

```env
VITE_API_URL=http://localhost:5000/api  # Development
# VITE_API_URL=https://api.yourdomain.com/api  # Production
```

## Testing Sample Members

Test with these sample members (already in database):

- **Rajesh Kumar** (FOL001) - Has gaps in payment
- **Priya Sharma** (FOL002) - All years paid
- **Amit Patel** (FOL003) - First-time member
- **Sneha Gupta** (FOL004) - Has skipped years
- **Vikram Singh** (FOL005) - Recent member

## Support

For issues or questions, contact Sunsys Technologies Pvt Ltd.

---

**Developed by Sunsys Technologies Pvt Ltd**
