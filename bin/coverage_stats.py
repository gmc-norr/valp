#!/usr/bin/env python3

import argparse
from collections.abc import Iterable
import csv
import json
import numpy as np
from pathlib import Path
from typing import List, Optional, Tuple
import pyd4


def parse_regions(filename: Path) -> List[Tuple[str, int, int, str]]:
    regions = []
    with open(filename) as bed:
        for line in csv.reader(bed, delimiter="\t"):
            regions.append(
                (
                    line[0],
                    int(line[1]),
                    int(line[2]),
                    line[3] if len(line) > 3 else f"{line[0]}:{line[1]}-{line[2]}",
                )
            )
    return regions


def global_coverage(
    d4: pyd4.D4File,
    include_chroms: Optional[List[str]] = None,
    bin_size: Optional[int] = None,
):
    res = []
    if bin_size is None:
        max_length = 0
        for name, length in d4.chroms():
            if include_chroms is not None and name not in include_chroms:
                continue
            if length > max_length:
                max_length = length
        bin_size = int(np.ceil(max_length / 200))

    for name, length in d4.chroms():
        if include_chroms is not None and name not in include_chroms:
            continue
        res.append(
            {
                "chromosome": name,
                "start": 0,
                "end": length,
                "length": length,
                "name": name,
                "mean_coverage": d4.mean(name),
                "bin_size": bin_size,
                "coverage": list(d4.resample(name, bin_size=bin_size)[0]),
            }
        )
    return res


def regional_coverage(
    d4: pyd4.D4File,
    regions: List[Tuple[str, int, int, str]],
    bin_size: Optional[int] = None,
):
    res = []
    dynamic_bins = bin_size is None
    for r in regions:
        length = r[2] - r[1]
        if dynamic_bins:
            bin_size = int(np.ceil(length / 200))
        res.append(
            {
                "chromosome": r[0],
                "start": r[1],
                "end": r[2],
                "length": length,
                "name": r[3],
                "mean_coverage": d4.mean(r[:3]),
                "bin_size": bin_size,
                "coverage": list(d4.resample(r[:3], bin_size=bin_size)[0]),
            }
        )
    return res


def main(
    d4_path: Path,
    regions: Optional[Path] = None,
    include_chroms: Optional[Iterable[str]] = None,
    no_global: bool = False,
    global_bin_size: Optional[int] = None,
    regional_bin_size: Optional[int] = None,
):
    d4 = pyd4.D4File(str(d4_path))

    d = {
        "global_coverage": [],
        "regional_coverage": [],
    }

    if regions is not None:
        r = parse_regions(regions)
        d["regional_coverage"] = regional_coverage(d4, r, bin_size=regional_bin_size)

    if not no_global:
        d["global_coverage"] = global_coverage(d4, include_chroms, bin_size=global_bin_size)

    print(json.dumps(d))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("d4", help="Path to d4 file to get coverage from", type=Path)
    parser.add_argument(
        "-i",
        "--include",
        help="Comma-separated string of chromosomes to include in the analysis (default: all)",
        type=str,
    )
    parser.add_argument(
        "-r",
        "--regions",
        help="BED file with regions to use for a targeted coverage analysis",
        type=Path,
    )
    parser.add_argument(
        "--no-global",
        help="Don't do a global coverage summary",
        action="store_true",
    )
    parser.add_argument(
        "--global-bin-size",
        help="Bin size to use for global coverage. Default is a bin size that gives "
            "200 bins for the longest included chromosome .",
        type=int,
    )
    parser.add_argument(
        "--regional-bin-size",
        help="Bin size to use for regional coverage. Default is a bin size that gives "
            "200 bins for the longest region.",
        type=int,
    )
    args = parser.parse_args()

    if args.no_global and args.regions is None:
        parser.error("no regions and no global analysis: nothing to do")

    if args.global_bin_size is not None and args.global_bin_size <= 0:
        parser.error("global bin size must be a non-zero positive integer")

    if args.regional_bin_size is not None and args.regional_bin_size <= 0:
        parser.error("regional bin size must be a non-zero positive integer")

    chroms = None
    if args.include is not None:
        chroms = args.include.strip().split(",")
        for i in range(len(chroms)):
            if not chroms[i].startswith("chr"):
                chroms[i] = f"chr{chroms[i]}"
        chroms = set(chroms)

    main(
        args.d4,
        regions=args.regions,
        include_chroms=chroms,
        no_global=args.no_global,
        global_bin_size=args.global_bin_size,
        regional_bin_size=args.regional_bin_size,
    )
