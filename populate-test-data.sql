-- Populate test data for Mangalm Sales Assistant

-- Add test stores
INSERT INTO stores (id, name, address, city, region, country, phone, email, contact_person, store_type, payment_terms, created_at, updated_at)
VALUES 
    ('4261931000001048015', 'Aarti Store - Mumbai Central', '123 Main St', 'Mumbai', 'Maharashtra', 'India', '+91-9876543210', 'aarti.mumbai@example.com', 'Rajesh Kumar', 'retail', 'NET_30', NOW(), NOW()),
    ('4261931000001048016', 'Ganesh Traders - Andheri', '456 Market Rd', 'Mumbai', 'Maharashtra', 'India', '+91-9876543211', 'ganesh.andheri@example.com', 'Suresh Patel', 'wholesale', 'NET_15', NOW(), NOW()),
    ('4261931000001048017', 'Krishna Mart - Pune', '789 Station Rd', 'Pune', 'Maharashtra', 'India', '+91-9876543212', 'krishna.pune@example.com', 'Amit Shah', 'retail', 'NET_30', NOW(), NOW()),
    ('4261931000001048018', 'Shree Stores - Thane', '321 Mall Rd', 'Thane', 'Maharashtra', 'India', '+91-9876543213', 'shree.thane@example.com', 'Vijay Sharma', 'retail', 'NET_45', NOW(), NOW()),
    ('4261931000001048019', 'Balaji Supermart - Nashik', '654 Highway Rd', 'Nashik', 'Maharashtra', 'India', '+91-9876543214', 'balaji.nashik@example.com', 'Prakash Verma', 'retail', 'NET_30', NOW(), NOW());

-- Add test products
INSERT INTO products (id, name, description, category, brand, unit, price, sku, created_at, updated_at)
VALUES 
    ('PROD001', 'Samosa', 'Crispy fried snack with potato filling', 'Snacks', 'Mangalm', 'piece', 12, 'SKU-SAM-001', NOW(), NOW()),
    ('PROD002', 'Chai', 'Traditional Indian tea', 'Beverages', 'Mangalm', 'cup', 10, 'SKU-CHA-001', NOW(), NOW()),
    ('PROD003', 'Bhel Puri', 'Mixed puffed rice snack', 'Snacks', 'Mangalm', 'kg', 280, 'SKU-BHE-001', NOW(), NOW()),
    ('PROD004', 'Pani Puri', 'Hollow crispy puri with flavored water', 'Snacks', 'Mangalm', 'plate', 30, 'SKU-PAN-001', NOW(), NOW()),
    ('PROD005', 'Kachori', 'Deep fried snack with lentil filling', 'Snacks', 'Mangalm', 'piece', 18, 'SKU-KAC-001', NOW(), NOW()),
    ('PROD006', 'Jalebi', 'Sweet syrupy dessert', 'Sweets', 'Mangalm', 'kg', 320, 'SKU-JAL-001', NOW(), NOW()),
    ('PROD007', 'Sev Puri', 'Flat crispy base with toppings', 'Snacks', 'Mangalm', 'plate', 35, 'SKU-SEV-001', NOW(), NOW()),
    ('PROD008', 'Vada Pav', 'Mumbai style burger', 'Snacks', 'Mangalm', 'piece', 20, 'SKU-VAD-001', NOW(), NOW());

-- Add some historical invoices for analytics
INSERT INTO historical_invoices (id, invoice_number, store_id, invoice_date, due_date, total_amount, status, payment_status, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'INV-2025-001', '4261931000001048015', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '23 days', 5420.50, 'completed', 'paid', NOW(), NOW()),
    (gen_random_uuid(), 'INV-2025-002', '4261931000001048016', CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE + INTERVAL '9 days', 8350.00, 'completed', 'paid', NOW(), NOW()),
    (gen_random_uuid(), 'INV-2025-003', '4261931000001048017', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '25 days', 3200.75, 'pending', 'pending', NOW(), NOW()),
    (gen_random_uuid(), 'INV-2025-004', '4261931000001048018', CURRENT_DATE - INTERVAL '4 days', CURRENT_DATE + INTERVAL '41 days', 6780.25, 'completed', 'partial', NOW(), NOW()),
    (gen_random_uuid(), 'INV-2025-005', '4261931000001048019', CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '27 days', 4560.00, 'pending', 'pending', NOW(), NOW()),
    (gen_random_uuid(), 'INV-2025-006', '4261931000001048015', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE + INTERVAL '28 days', 7890.50, 'completed', 'paid', NOW(), NOW()),
    (gen_random_uuid(), 'INV-2025-007', '4261931000001048016', CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE + INTERVAL '14 days', 9120.00, 'pending', 'pending', NOW(), NOW()),
    (gen_random_uuid(), 'INV-2025-008', '4261931000001048017', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 5670.25, 'pending', 'pending', NOW(), NOW());

-- Add some predicted orders
INSERT INTO predicted_orders (id, store_id, predicted_date, confidence, total_amount, status, created_at, updated_at)
VALUES 
    (gen_random_uuid(), '4261931000001048015', CURRENT_DATE + INTERVAL '1 day', 0.92, 6500.00, 'pending', NOW(), NOW()),
    (gen_random_uuid(), '4261931000001048016', CURRENT_DATE + INTERVAL '2 days', 0.88, 8900.00, 'pending', NOW(), NOW()),
    (gen_random_uuid(), '4261931000001048017', CURRENT_DATE + INTERVAL '1 day', 0.85, 4200.00, 'pending', NOW(), NOW()),
    (gen_random_uuid(), '4261931000001048018', CURRENT_DATE + INTERVAL '3 days', 0.79, 7100.00, 'pending', NOW(), NOW()),
    (gen_random_uuid(), '4261931000001048019', CURRENT_DATE + INTERVAL '2 days', 0.91, 5300.00, 'pending', NOW(), NOW());

-- Add call prioritization data
INSERT INTO call_prioritization (id, store_id, priority_score, priority_reason, confidence, next_order_date, expected_order_value, days_since_last_order, status, created_at, updated_at)
VALUES 
    (gen_random_uuid(), '4261931000001048015', 95.5, 'High value customer - order expected tomorrow', 0.92, CURRENT_DATE + INTERVAL '1 day', 6500.00, 2, 'pending', NOW(), NOW()),
    (gen_random_uuid(), '4261931000001048016', 88.0, 'Regular customer - consistent ordering pattern', 0.88, CURRENT_DATE + INTERVAL '2 days', 8900.00, 1, 'pending', NOW(), NOW()),
    (gen_random_uuid(), '4261931000001048017', 82.5, 'Medium priority - order likely soon', 0.85, CURRENT_DATE + INTERVAL '1 day', 4200.00, 5, 'pending', NOW(), NOW()),
    (gen_random_uuid(), '4261931000001048018', 75.0, 'Lower confidence prediction', 0.79, CURRENT_DATE + INTERVAL '3 days', 7100.00, 4, 'pending', NOW(), NOW()),
    (gen_random_uuid(), '4261931000001048019', 91.0, 'High confidence - regular pattern detected', 0.91, CURRENT_DATE + INTERVAL '2 days', 5300.00, 3, 'pending', NOW(), NOW());

-- Add some test orders (as if from uploaded documents)
INSERT INTO orders (
    id, order_number, store_id, customer_name, customer_phone, customer_email,
    items, item_count, total_quantity, subtotal_amount, tax_amount, total_amount,
    totals, status, source, created_by, notes, created_at, updated_at
)
VALUES 
    (gen_random_uuid(), 'ORD-2025-TEST-001', '4261931000001048015', 'Aarti Store - Mumbai Central', '+91-9876543210', 'aarti.mumbai@example.com',
     '[{"productName": "Samosa", "quantity": 100, "unitPrice": 12, "totalPrice": 1200}, {"productName": "Chai", "quantity": 50, "unitPrice": 10, "totalPrice": 500}]'::jsonb,
     2, 150, 1700, 306, 2006, '{"subtotal": 1700, "tax": 306, "total": 2006}'::jsonb,
     'pending_review', 'document', 'system', 'Uploaded from scanned document', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
     
    (gen_random_uuid(), 'ORD-2025-TEST-002', '4261931000001048016', 'Ganesh Traders - Andheri', '+91-9876543211', 'ganesh.andheri@example.com',
     '[{"productName": "Bhel Puri", "quantity": 10, "unitPrice": 280, "totalPrice": 2800}, {"productName": "Pani Puri", "quantity": 20, "unitPrice": 30, "totalPrice": 600}]'::jsonb,
     2, 30, 3400, 612, 4012, '{"subtotal": 3400, "tax": 612, "total": 4012}'::jsonb,
     'confirmed', 'manual', 'admin', 'Manual order entry', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes');

PRINT 'Test data populated successfully!';