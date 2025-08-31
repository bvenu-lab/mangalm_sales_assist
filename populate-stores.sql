-- Add more stores from the CSV data
INSERT INTO stores (id, name, address, city, state, zip, phone, email, created_at) VALUES
('4261931000001048015', 'Mangalam Store 1', '123 Main St', 'Portland', 'OR', '97201', '503-555-0001', 'store1@mangalam.com', NOW()),
('4261931000001048016', 'Mangalam Store 2', '456 Oak Ave', 'Beaverton', 'OR', '97005', '503-555-0002', 'store2@mangalam.com', NOW()),
('4261931000000166057', 'Mangalam Store 3', '789 Pine St', 'Hillsboro', 'OR', '97123', '503-555-0003', 'store3@mangalam.com', NOW()),
('4261931000000958125', 'Mangalam Store 4', '321 Elm Way', 'Lake Oswego', 'OR', '97034', '503-555-0004', 'store4@mangalam.com', NOW()),
('4261931000000094025', 'Mangalam Store 5', '654 Cedar Ln', 'Tigard', 'OR', '97223', '503-555-0005', 'store5@mangalam.com', NOW()),
('4261931000000166072', 'Mangalam Store 6', '987 Maple Dr', 'Gresham', 'OR', '97030', '503-555-0006', 'store6@mangalam.com', NOW()),
('4261931000000093024', 'Mangalam Store 7', '147 Birch Rd', 'Oregon City', 'OR', '97045', '503-555-0007', 'store7@mangalam.com', NOW()),
('4261931000000166065', 'Mangalam Store 8', '258 Spruce Ave', 'Milwaukie', 'OR', '97222', '503-555-0008', 'store8@mangalam.com', NOW()),
('4261931000000094059', 'Mangalam Store 9', '369 Ash Ct', 'West Linn', 'OR', '97068', '503-555-0009', 'store9@mangalam.com', NOW()),
('4261931000000166080', 'Mangalam Store 10', '741 Willow Way', 'Happy Valley', 'OR', '97015', '503-555-0010', 'store10@mangalam.com', NOW()),
('4261931000000094068', 'Mangalam Store 11', '852 Poplar St', 'Tualatin', 'OR', '97062', '503-555-0011', 'store11@mangalam.com', NOW()),
('4261931000000095103', 'Mangalam Store 12', '963 Sycamore Ln', 'Sherwood', 'OR', '97140', '503-555-0012', 'store12@mangalam.com', NOW()),
('4261931000000092077', 'Mangalam Store 13', '159 Redwood Rd', 'Wilsonville', 'OR', '97070', '503-555-0013', 'store13@mangalam.com', NOW()),
('4261931000001167019', 'Mangalam Store 14', '753 Hickory Dr', 'Canby', 'OR', '97013', '503-555-0014', 'store14@mangalam.com', NOW()),
('4261931000000166049', 'Mangalam Store 15', '951 Chestnut Ave', 'Sandy', 'OR', '97055', '503-555-0015', 'store15@mangalam.com', NOW())
ON CONFLICT (id) DO NOTHING;

-- Add test products
INSERT INTO products (id, name, sku, price, cost, category, brand, created_at) VALUES
('PROD001', 'Samosa', 'SAM001', 12.00, 8.00, 'Snacks', 'Mangalam', NOW()),
('PROD002', 'Chai', 'CHA001', 20.00, 12.00, 'Beverages', 'Mangalam', NOW()),
('PROD003', 'Bhel Puri', 'BHE001', 25.00, 15.00, 'Snacks', 'Mangalam', NOW()),
('PROD004', 'Pani Puri', 'PAN001', 30.00, 18.00, 'Snacks', 'Mangalam', NOW()),
('PROD005', 'Sev Puri', 'SEV001', 28.00, 16.00, 'Snacks', 'Mangalam', NOW()),
('PROD006', 'Vada Pav', 'VAD001', 15.00, 9.00, 'Snacks', 'Mangalam', NOW()),
('PROD007', 'Bhujia', 'BHU001', 35.00, 20.00, 'Snacks', 'Mangalam', NOW()),
('PROD008', 'Mixture', 'MIX001', 40.00, 24.00, 'Snacks', 'Mangalam', NOW()),
('PROD009', 'Dal', 'DAL001', 45.00, 27.00, 'Groceries', 'Mangalam', NOW()),
('PROD010', 'Rice', 'RIC001', 50.00, 30.00, 'Groceries', 'Mangalam', NOW())
ON CONFLICT (id) DO NOTHING;