# Project: Pool & Services Pass Application

## System Context for AI Prompts
* **Goal:** A Progressive Web App (PWA) for reserving pool passes and future scheduled services.
* **Architecture:** Next.js (App Router) or SvelteKit.
* **Styling & UI:** Tailwind CSS + shadcn/ui (Mobile-first design).
* **Database & Auth:** Supabase (PostgreSQL).
* **Payment Integration:** Pago Móvil C2P via Mercantil Banco API.
* **Dynamic Pricing:** USD prices converted to VES dynamically via the official BCV exchange rate.
* **Email Service:** Resend.

---

## HU-01: Mobile-First Booking UI & Attendee Selection
**Objective:** Create the core mobile-responsive booking form for selecting dates and attendee quantities.

**Description:** Develop a touch-friendly UI where users can pick a reservation date and select the number of adults ($15) and children ($5). The interface must dynamically calculate the total price in USD. 

**Acceptance Criteria:**
- Implement a responsive calendar/date-picker component.
- Include a counter (stepper) for Adults and Children.
- Display the real-time total price in USD.
- Ensure all tap targets are at least 44x44px for mobile accessibility.
- Include basic user contact fields: First Name, Last Name, Email.

---

## HU-02: Identification & C2P Payment Form
**Objective:** Securely collect Venezuelan DNI data and Pago Móvil C2P credentials.

**Description:**
Create the checkout phase of the booking flow to collect the user's specific Identification and the C2P payment data required by Mercantil Banco.

**Acceptance Criteria:**
- Form fields required: Identification Type (Dropdown: V, E, P, J), ID Number, Phone Number, Bank (Dropdown of Venezuelan banks), and Clave de Pago (OTP).
- Validate that the phone number matches the standard Venezuelan format.
- Upon submission, create a temporary `pending_payment` record in the database to lock the daily capacity for that specific date.

---

## HU-03: BCV Rate Fetch & Mercantil C2P Server Action
**Objective:** Process the payment server-side using the BCV exchange rate and Mercantil's C2P API.

**Description:**
Write a secure Server Action / API Route that intercepts the payment submission, calculates the VES total, encrypts the payload, and charges the user via the Mercantil API.

**Acceptance Criteria:**
- Fetch the daily USD exchange rate from a public BCV API endpoint.
- Calculate the VES total: `(Total USD) * (BCV Rate)`.
- Use Node's `crypto` module to AES-256-cbc encrypt the sensitive fields (`destination_id`, `destination_mobile_number`, `twofactor_auth`) using the Mercantil provided secret keys.
- Send a POST request to Mercantil's `v1/payment/pay` endpoint.
- If the transaction status is `approved`, update the database reservation status to `confirmed`. If failed, release the capacity slot.

---

## HU-04: Capacity Management & Validation
**Objective:** Enforce daily limits on the number of people allowed in the pool.

**Description:**
Before locking capacity in HU-02, the database must verify that the requested number of attendees does not breach the daily configured limit.

**Acceptance Criteria:**
- Run an aggregation query summing all attendees for the requested date.
- If `current_sum + requested_quantity > daily_capacity_limit`, reject the transaction and inform the user of the remaining available slots.
- Wrap the check and the insertion in a single database transaction to prevent double-booking race conditions.

---

## HU-05: Automated Voucher Delivery
**Objective:** Send a digital access pass to the user's email upon successful payment.

**Description:**
Once the Mercantil payment returns as approved and the database is updated, automatically dispatch an email containing the booking details so the user can present it at the gate alongside their physical ID.

**Acceptance Criteria:**
- Trigger the Resend API server-side.
- The email template must include: User Name, DNI, Date of Reservation, Number of Adults/Children, Total Paid (USD & VES), and a unique Reservation ID.
- The email design must be clean and highly legible on mobile screens.
