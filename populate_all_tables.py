import csv
import hashlib
import psycopg2
from datetime import datetime
import random

# Database connection
conn = psycopg2.connect(
    host="localhost",
    port=3432,
    database="mangalm_sales",
    user="postgres",
    password="postgres"
)
cur = conn.cursor()

# Read CSV and extract unique products
products = {}
invoice_items = []

with open(r'C:\code\mangalm\user_journey\Invoices_Mangalam.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Extract product info
        item_name = row.get('Item Name', '').strip()
        if item_name and item_name not in products:
            # Generate product ID
            hash_bytes = hashlib.md5(item_name.encode()).digest()
            product_id = int.from_bytes(hash_bytes[:8], byteorder='big') % (10**18)
            
            # Parse price
            try:
                price = float(row.get('Item Price', '0').replace('$', '').replace(',', ''))
            except:
                price = 0.0
            
            products[item_name] = {
                'id': product_id,
                'name': item_name,
                'price': price,
                'category': 'Food' if any(x in item_name.lower() for x in ['rice', 'dal', 'flour', 'oil', 'spice']) else 'Grocery',
                'brand': item_name.split()[0] if ' ' in item_name else 'Generic'
            }
        
        # Collect invoice items
        invoice_id = row.get('Invoice ID', '')
        if invoice_id and item_name:
            try:
                quantity = float(row.get('Quantity', '1'))
                total = float(row.get('Total', '0').replace('$', '').replace(',', ''))
            except:
                quantity = 1
                total = 0
            
            invoice_items.append({
                'invoice_id': invoice_id,
                'product_name': item_name,
                'quantity': quantity,
                'price': products[item_name]['price'],
                'total': total
            })

print(f"Found {len(products)} unique products")
print(f"Found {len(invoice_items)} invoice items")

# Insert products
print("\nInserting products...")
for name, product in products.items():
    try:
        cur.execute("""
            INSERT INTO products (id, name, description, category, brand, price, cost, stock, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        """, (
            product['id'],
            product['name'],
            f"High quality {product['name']}",
            product['category'],
            product['brand'],
            product['price'],
            product['price'] * 0.7,  # 30% margin
            random.randint(100, 1000),  # Random stock
            True
        ))
    except Exception as e:
        print(f"Error inserting product {name}: {e}")

conn.commit()
print(f"Inserted {cur.rowcount} products")

# Get order IDs for invoice items
cur.execute("SELECT id, order_number FROM orders")
order_map = {row[1]: row[0] for row in cur.fetchall()}

# Insert invoice items
print("\nInserting invoice items...")
inserted_items = 0
for item in invoice_items:
    # Find matching order
    order_id = None
    for order_num, oid in order_map.items():
        if item['invoice_id'] in order_num or order_num in item['invoice_id']:
            order_id = oid
            break
    
    if order_id and item['product_name'] in products:
        try:
            cur.execute("""
                INSERT INTO invoice_items (
                    order_id, product_id, product_name, quantity, 
                    unit_price, total_price, discount, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT DO NOTHING
            """, (
                order_id,
                products[item['product_name']]['id'],
                item['product_name'],
                item['quantity'],
                item['price'],
                item['total'],
                0
            ))
            inserted_items += 1
        except Exception as e:
            pass  # Skip errors

conn.commit()
print(f"Inserted {inserted_items} invoice items")

# Generate upselling recommendations
print("\nGenerating upselling recommendations...")
cur.execute("""
    INSERT INTO upselling_recommendations (
        order_id, store_id, product_id, recommendation_type,
        confidence_score, expected_revenue, reason, status, created_at
    )
    SELECT 
        o.id,
        o.store_id,
        p.id,
        CASE 
            WHEN p.price > 50 THEN 'upsell'
            WHEN p.category = 'Food' THEN 'cross_sell'
            ELSE 'bundle'
        END,
        RANDOM() * 0.5 + 0.5,  -- 50-100% confidence
        p.price * 1.2,  -- 20% markup
        'Frequently bought together',
        'pending',
        NOW()
    FROM orders o
    CROSS JOIN products p
    WHERE RANDOM() < 0.1  -- 10% of combinations
    LIMIT 500
    ON CONFLICT DO NOTHING
""")
conn.commit()
print(f"Generated {cur.rowcount} upselling recommendations")

# Final counts
cur.execute("""
    SELECT 'products' as table_name, COUNT(*) FROM products
    UNION ALL SELECT 'invoice_items', COUNT(*) FROM invoice_items
    UNION ALL SELECT 'upselling_recommendations', COUNT(*) FROM upselling_recommendations
    UNION ALL SELECT 'orders', COUNT(*) FROM orders
""")

print("\n=== FINAL TABLE COUNTS ===")
for row in cur.fetchall():
    print(f"{row[0]}: {row[1]} records")

cur.close()
conn.close()