"""Read-only, rate-limited independent barcode coverage sample. Python stdlib only.

Run: python experiments/barcode-lookup/run_lookup.py
Source codes are selected BEFORE lookups from retailer/manufacturer documents.
HTTP errors are not counted as missing products. Stops on access/rate denial.
"""
import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent


def valid_gtin(code):
    if len(code) not in (8, 12, 13, 14) or not code.isascii() or not code.isdigit():
        return False
    total = sum(int(c) * (3 if i % 2 == 0 else 1) for i, c in enumerate(reversed(code[:-1])))
    return (10 - total % 10) % 10 == int(code[-1])


def main():
    sample = json.loads((BASE / 'sample.json').read_text(encoding='utf-8'))
    results = []
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    output = BASE / ('results-' + run_id + '.json')
    for item in sample:
        code = item['code']
        host = 'world.openbeautyfacts.org' if item['database'] == 'OBF' else 'world.openfoodfacts.org'
        url = f'https://{host}/api/v3.6/product/{code}.json?fields=code,product_name,brands,quantity,last_modified_t,countries_tags'
        record = {**item, 'request_url': url, 'requested_at_utc': datetime.now(timezone.utc).isoformat(),
                  'checksum_valid': valid_gtin(code), 'price': None, 'store': None}
        req = urllib.request.Request(url, headers={'User-Agent': 'BarcodePriceScannerResearch/0.1 (read-only independent coverage audit)'})
        try:
            with urllib.request.urlopen(req, timeout=25) as response:
                record['http_status'] = response.status
                record['response_date'] = response.headers.get('Date')
                payload = response.read().decode('utf-8')
        except urllib.error.HTTPError as error:
            record['http_status'] = error.code
            payload = error.read().decode('utf-8', errors='replace')
        except Exception as error:
            record.update(outcome='TRANSPORT_ERROR', error=str(error))
            payload = None
        if payload is not None:
            try:
                data = json.loads(payload)
                record['response'] = data
                result_id = data.get('result', {}).get('id')
                if record['http_status'] == 200 and data.get('product') and result_id == 'product_found':
                    record['outcome'] = 'FOUND'
                elif result_id == 'product_not_found' and record['http_status'] in (200, 404):
                    record['outcome'] = 'NOT_FOUND'
                else:
                    record['outcome'] = 'UNRESOLVED_RESPONSE'
            except ValueError:
                record['outcome'] = 'NON_JSON_ERROR'
                record['response_excerpt'] = payload[:500]
        record['received_at_utc'] = datetime.now(timezone.utc).isoformat()
        results.append(record)
        output.write_text(json.dumps({'run_id':run_id, 'sample_method':'purposive independent primary-document sample; not market-representative', 'results':results}, ensure_ascii=False, indent=2), encoding='utf-8')
        print(code, record['outcome'], flush=True)
        if record.get('http_status') in (401, 403, 429):
            print('Stopped: authorization or rate/access restriction.', flush=True)
            break
        time.sleep(5)
    print('Saved:', output, flush=True)


if __name__ == '__main__':
    main()
