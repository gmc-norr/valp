#!/usr/bin/env python3

import argparse
from pathlib import Path


def main(fai: Path, chroms: list[str] = []):
    with open(fai) as f:
        for line in f:
            line = line.strip().split("\t")
            chrom = line[0]
            length = int(line[1])

            chrom_id = chrom
            if chrom.startswith("chr"):
                chrom_id = chrom[3:]

            if chrom_id not in chroms:
                continue

            print(f"{chrom}\t1\t{length}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("fai", type=Path)
    parser.add_argument("-i", "--include", help="comma separated list of chromosomes to include", default="")
    args = parser.parse_args()
    chroms = args.include.split(",")
    main(args.fai, chroms=chroms)
