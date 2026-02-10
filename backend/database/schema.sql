-- Create Database
CREATE DATABASE IF NOT EXISTS membership_payment_db;
USE membership_payment_db;

-- Members Table
CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    folio_number VARCHAR(50) UNIQUE NOT NULL,
    status ENUM('active', 'inactive', 'removed') DEFAULT 'active',
    deleted_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_folio (folio_number),
    INDEX idx_phone (phone),
    INDEX idx_status (status),
    INDEX idx_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Membership Payments Table
CREATE TABLE IF NOT EXISTS membership_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    membership_year_start DATE NOT NULL,
    membership_year_end DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 1200.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_date DATETIME NULL,
    transaction_id VARCHAR(100) NULL,
    razorpay_order_id VARCHAR(100) NULL,
    razorpay_payment_id VARCHAR(100) NULL,
    razorpay_signature VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_membership_payments_member_id FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX idx_member_id (member_id),
    INDEX idx_payment_status (payment_status),
    INDEX idx_membership_year (membership_year_start, membership_year_end),
    UNIQUE KEY unique_member_year (member_id, membership_year_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Import History Table (Track Excel imports)
CREATE TABLE IF NOT EXISTS import_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    members_added INT NOT NULL DEFAULT 0,
    members_updated INT NOT NULL DEFAULT 0,
    payments_added INT NOT NULL DEFAULT 0,
    errors INT NOT NULL DEFAULT 0,
    error_details TEXT NULL,
    imported_by VARCHAR(255) NULL,
    import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_import_date (import_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Sample Members for Testing
INSERT INTO members (name, phone, email, folio_number) VALUES
('Rajesh Kumar', '9876543210', 'rajesh.kumar@email.com', 'FOL001'),
('Priya Sharma', '9876543211', 'priya.sharma@email.com', 'FOL002'),
('Amit Patel', '9876543212', 'amit.patel@email.com', 'FOL003'),
('Sneha Gupta', '9876543213', 'sneha.gupta@email.com', 'FOL004'),
('Vikram Singh', '9876543214', 'vikram.singh@email.com', 'FOL005');

-- Insert Sample Payment History (for testing sequential logic)
-- Rajesh Kumar - Paid 2022-23, 2023-24 (Missing 2024-25)
INSERT INTO membership_payments (member_id, membership_year_start, membership_year_end, amount, payment_status, payment_date, transaction_id) VALUES
(1, '2022-04-01', '2023-03-31', 1200.00, 'success', '2022-04-15 10:30:00', 'TXN001'),
(1, '2023-04-01', '2024-03-31', 1200.00, 'success', '2023-04-20 14:15:00', 'TXN002');

-- Priya Sharma - Paid all years up to 2024-25
INSERT INTO membership_payments (member_id, membership_year_start, membership_year_end, amount, payment_status, payment_date, transaction_id) VALUES
(2, '2021-04-01', '2022-03-31', 1200.00, 'success', '2021-04-10 09:00:00', 'TXN003'),
(2, '2022-04-01', '2023-03-31', 1200.00, 'success', '2022-04-12 11:30:00', 'TXN004'),
(2, '2023-04-01', '2024-03-31', 1200.00, 'success', '2023-04-15 10:00:00', 'TXN005'),
(2, '2024-04-01', '2025-03-31', 1200.00, 'success', '2024-04-18 12:00:00', 'TXN006');

-- Amit Patel - No payment history (first-time member)
-- Sneha Gupta - Paid only 2023-24 (Missing 2021-22, 2022-23, 2024-25)
INSERT INTO membership_payments (member_id, membership_year_start, membership_year_end, amount, payment_status, payment_date, transaction_id) VALUES
(4, '2023-04-01', '2024-03-31', 1200.00, 'success', '2023-04-25 16:30:00', 'TXN007');

-- Vikram Singh - Paid 2024-25 only
INSERT INTO membership_payments (member_id, membership_year_start, membership_year_end, amount, payment_status, payment_date, transaction_id) VALUES
(5, '2024-04-01', '2025-03-31', 1200.00, 'success', '2024-04-22 13:45:00', 'TXN008');

-- Latest Member with Payment Table
CREATE TABLE IF NOT EXISTS latest_member_with_payment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    folio_number VARCHAR(50) NOT NULL,
    member_status ENUM('active', 'inactive', 'removed') DEFAULT 'active',
    created_at DATETIME,
    payment_id INT NULL,
    membership_year_start DATE NULL,
    membership_year_end DATE NULL,
    amount DECIMAL(10,2) NULL,
    payment_status VARCHAR(20) NULL,
    payment_date DATETIME NULL,
    transaction_id VARCHAR(100) NULL,
    razorpay_order_id VARCHAR(100) NULL,
    razorpay_payment_id VARCHAR(100) NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_member (member_id),
    INDEX idx_member_id (member_id),
    INDEX idx_folio (folio_number),
    INDEX idx_phone (phone),
    INDEX idx_payment_status (payment_status),
    CONSTRAINT fk_latest_member_id FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Populate latest_member_with_payment table with current data
INSERT INTO latest_member_with_payment 
(member_id, name, phone, email, folio_number, member_status, created_at, 
 payment_id, membership_year_start, membership_year_end, amount, payment_status, payment_date, transaction_id, razorpay_order_id, razorpay_payment_id)
SELECT 
    m.id,
    m.name,
    m.phone,
    m.email,
    m.folio_number,
    m.status,
    m.created_at,
    mp.id,
    mp.membership_year_start,
    mp.membership_year_end,
    mp.amount,
    mp.payment_status,
    mp.payment_date,
    mp.transaction_id,
    mp.razorpay_order_id,
    mp.razorpay_payment_id
FROM members m
LEFT JOIN membership_payments mp ON m.id = mp.member_id 
    AND mp.id = (
        SELECT MAX(id) FROM membership_payments 
        WHERE member_id = m.id
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    phone = VALUES(phone),
    email = VALUES(email),
    folio_number = VALUES(folio_number),
    member_status = VALUES(member_status),
    membership_year_start = VALUES(membership_year_start),
    membership_year_end = VALUES(membership_year_end),
    amount = VALUES(amount),
    payment_status = VALUES(payment_status),
    payment_date = VALUES(payment_date),
    transaction_id = VALUES(transaction_id),
    razorpay_order_id = VALUES(razorpay_order_id),
    razorpay_payment_id = VALUES(razorpay_payment_id),
    last_updated = CURRENT_TIMESTAMP;
