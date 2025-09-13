import csv
import hashlib

# Read the CSV file
customers = set()
with open(r'C:\code\mangalm\user_journey\Invoices_Mangalam.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        name = row.get('Customer Name', '').strip()
        if name:
            customers.add(name)

print(f"-- Creating {len(customers)} stores")
print("INSERT INTO stores (id, name, address, city, state, zip, phone, email, region, is_active, created_at, updated_at) VALUES")

values = []
for name in sorted(customers):
    # Generate consistent store ID from customer name
    hash_bytes = hashlib.md5(name.encode()).digest()
    # Use first 8 bytes as a positive integer
    store_id = int.from_bytes(hash_bytes[:8], byteorder='big') % (10**18) + 4261931000000000000
    
    # Clean name for SQL
    sql_name = name.replace("'", "''")
    
    # Generate dummy but consistent data
    city = 'San Francisco' if 'SF' in name or 'San' in name else 'Portland' if 'Portland' in name else 'Seattle' if 'Seattle' in name else 'Sacramento'
    state = 'CA' if city in ['San Francisco', 'Sacramento'] else 'OR' if city == 'Portland' else 'WA'
    region = 'West Coast'
    
    values.append(f"({store_id}, '{sql_name}', '123 Main St', '{city}', '{state}', '94102', '555-0100', '{sql_name.lower().replace(' ', '.')}@example.com', '{region}', true, NOW(), NOW())")

print(',\n'.join(values) + ';')