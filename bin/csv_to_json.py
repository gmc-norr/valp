#!/usr/bin/env python3

import argparse
import csv
import json
from typing import Tuple, Union

def parse_int(x: str) -> Tuple[bool, int]:
    try:
        ix = int(x)
        return True, ix
    except ValueError:
        return False, 0

def parse_float(x: str) -> Tuple[bool, float]:
    try:
        ix = float(x)
        return True, ix
    except ValueError:
        return False, 0

def parse_json_value(x: str) -> Union[int, float, str]:
    ok, v = parse_int(x)
    if ok:
        return v
    ok, v = parse_float(x)
    if ok:
        return v
    return x


def main(csvfile, outfile):
    rows = []

    with open(csvfile) as f:
        reader = csv.DictReader(f)
        for row in reader:
            new_row = {}
            for k, v in row.items():
                new_row[k.lower()] = parse_json_value(v)
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
