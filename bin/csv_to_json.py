#!/usr/bin/env python3

import argparse
import csv
import json

def main(csvfile, outfile):
    rows = []

    with open(csvfile) as f:
        reader = csv.DictReader(f)
        for row in reader:
            new_row = {}
            for k, v in row.items():
                new_row[k.lower()] = v
            rows.append(new_row)

    json_string = json.dumps({"column_names": list(rows[0].keys()), "rows": rows})

    if outfile is None:
        print(json_string)
    else:
        with open(outfile, "w") as f:
            f.write(json_string)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", help="CSV file that should be converted to JSON")
    parser.add_argument("-o", dest="output", help="File to write output to")
    args = parser.parse_args()
    main(args.csv, args.output)
