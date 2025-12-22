import json
import csv
import os
from datetime import datetime
from collections import defaultdict

# Define paths
json_path = 'supabase/functions/capture-payload/payload.json'
csv_path = 'supabase/functions/capture-payload/payload_flattened.csv'
summary_csv_path = 'supabase/functions/capture-payload/daily_device_comparison.csv'

def process_payload():
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found.")
        return

    with open(json_path, 'r') as f:
        payload = json.load(f)

    metrics = payload.get('data', {}).get('metrics', [])
    
    all_rows = []
    # Structure: daily_data[date][metric][device] = [list of values]
    daily_data = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))

    for metric in metrics:
        name = metric.get('name')
        units = metric.get('units')
        data_points = metric.get('data', [])
        
        for point in data_points:
            # Flatten for the main CSV
            row = {
                'metric_name': name,
                'metric_units': units,
                **point
            }
            all_rows.append(row)

            # Process for Summary
            source = point.get('source', 'Unknown')
            date_str = point.get('date', '')
            
            # Simple check for quantity field (qty is standard, but sleep has totalsleep, etc.)
            val = point.get('qty')
            if val is None:
                val = point.get('value')
            
            if date_str and val is not None:
                try:
                    # Extract YYYY-MM-DD
                    date_obj = datetime.strptime(date_str[:10], '%Y-%m-%d')
                    clean_date = date_obj.strftime('%Y-%m-%d')
                    daily_data[clean_date][name][source].append(float(val))
                except Exception:
                    continue

    # 1. Save flattened CSV (The "everything" view)
    if all_rows:
        all_keys = set()
        for r in all_rows: all_keys.update(r.keys())
        sorted_keys = sorted(list(all_keys))
        preferred = ['metric_name', 'date', 'qty', 'source', 'metric_units']
        for p in reversed(preferred):
            if p in sorted_keys:
                sorted_keys.remove(p)
                sorted_keys.insert(0, p)

        with open(csv_path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=sorted_keys)
            writer.writeheader()
            writer.writerows(all_rows)
        print(f"Successfully converted {len(all_rows)} data points to {csv_path}")

    # 2. Save Summary CSV (The "comparison" view)
    summary_rows = []
    for date in sorted(daily_data.keys()):
        for metric in sorted(daily_data[date].keys()):
            for device in sorted(daily_data[date][metric].keys()):
                values = daily_data[date][metric][device]
                
                # Logic: Sum for counts/energy, Average for rates/measurements
                if any(word in metric for word in ['count', 'energy', 'distance', 'active', 'flights']):
                    result = sum(values)
                    agg_type = "Total (Sum)"
                else:
                    result = sum(values) / len(values)
                    agg_type = "Average"
                
                summary_rows.append({
                    'Date': date,
                    'Metric': metric,
                    'Device': device,
                    'Value': round(result, 2),
                    'Aggregation': agg_type
                })

    if summary_rows:
        with open(summary_csv_path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['Date', 'Metric', 'Device', 'Value', 'Aggregation'])
            writer.writeheader()
            writer.writerows(summary_rows)
        print(f"Successfully created daily summary: {summary_csv_path}")

if __name__ == "__main__":
    process_payload()
