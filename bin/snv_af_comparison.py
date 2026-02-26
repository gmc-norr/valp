#!/usr/bin/env python3

import argparse
import csv
import logging
import sys
import cyvcf2
from pathlib import Path
from typing import TextIO, Tuple


logging.basicConfig(
    stream=sys.stderr,
    format="%(asctime)s | %(levelname)8s | %(message)s",
    level=logging.NOTSET,
)
logger = logging.getLogger(__name__)


def get_tp_positions(f: TextIO) -> list[Tuple[str, int, str, str]]:
    logger.debug("getting variant positions")
    positions = []
    vcf = cyvcf2.VCF(f)
    for variant in vcf:
        classifications = variant.format("BD")
        variant_types = variant.format("BVT")
        if not all(t == "SNP" for t in variant_types) or not all(
            c == "TP" for c in classifications
        ):
            continue
        if len(variant.ALT) != 1:
            continue
        positions.append((variant.CHROM, variant.POS, variant.REF, variant.ALT[0]))
    logger.debug(f"found TP variants in {len(positions)} positions")
    return positions


def extract_variants(
    f: TextIO, positions: list[Tuple[str, int, str, str]]
) -> dict[Tuple[str, int], cyvcf2.Variant]:
    variants = {}
    vcf = cyvcf2.VCF(f)
    for p in positions:
        vars = list(vcf(f"{p[0]}:{p[1]}-{p[1]}"))
        logger.debug(f"found {len(vars)} variants in position {p}")
        found_at_pos = False
        for v in vars:
            if len(v.ALT) > 1:
                raise ValueError("found multiallelic variant, shouldn't be the case")
            if len(v.REF) > 1 or len(v.ALT[0]) > 1:
                logger.debug(f"not strictly a SNP, ignoring: {v}")
                continue
            relative_pos = p[1] - v.POS

            logger.debug(f"relative position: {relative_pos}")
            logger.debug(f"matching variants: {p, v}")

            if v.REF != p[2]:
                logger.debug(
                    f"mismatching reference allele {p[2]} for variant at {v.CHROM}:{v.POS}, found {v.REF}"
                )
                continue

            if p[3] != v.ALT[0]:
                logger.debug(
                    f"mismatching alternative allele {p[3]} for variant at {v.CHROM}:{v.POS}, found {v.ALT[0]}"
                )
                continue

            found_at_pos = True
            variants[p[:2]] = v
        if not found_at_pos:
            logger.debug(f"could not find any matching variants at position {p}")
    return variants


def variant_af(v: cyvcf2.Variant) -> float:
    ad = v.format("AD")
    for sample in ad:
        ref_ad, alt_ad = sample
        return float(alt_ad) / (ref_ad + alt_ad)
    return ad


def variant_overlap(a: cyvcf2.Variant, b: cyvcf2.Variant) -> bool:
    if a.CHROM == b.CHROM:
        if a.POS >= b.POS and a.POS <= b.POS + len(b.REF):
            return True
    return False


def main(happy, truth, query):
    with open(happy) as f:
        positions = get_tp_positions(f)

    logger.info(f"extracting variants from {truth}")
    with open(truth) as f:
        truth_variants = extract_variants(f, positions)

    logger.info(f"extracting variants from {query}")
    with open(query) as f:
        query_variants = extract_variants(f, positions)

    if len(truth_variants) != len(query_variants):
        logger.warning(
            f"did not get the same number of variants from truth and query sets: {len(truth_variants)} vs {len(query_variants)}"
        )
        logger.warning("will try to address this by excluding missing overlaps")

    writer = csv.writer(sys.stdout, delimiter="\t")
    writer.writerow(
        [
            "query_chrom",
            "query_pos",
            "query_ref",
            "query_alt",
            "query_af",
            "truth_chrom",
            "truth_pos",
            "truth_ref",
            "truth_alt",
            "truth_af",
        ]
    )

    for p in positions:
        if p[:2] not in query_variants or p[:2] not in truth_variants:
            continue
        q = query_variants[p[:2]]
        t = truth_variants[p[:2]]
        writer.writerow(
            [
                q.CHROM,
                q.POS,
                q.REF,
                q.ALT[0],
                variant_af(q),
                t.CHROM,
                t.POS,
                t.REF,
                t.ALT[0],
                variant_af(t),
            ]
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument("happy", type=Path)
    parser.add_argument("truth", type=Path)
    parser.add_argument("query", type=Path)

    parser.add_argument(
        "-v", dest="verbose", action="count", help="increase verbosity", default=0
    )

    args = parser.parse_args()

    if args.verbose > 1:
        logger.setLevel(logging.DEBUG)
    elif args.verbose > 0:
        logger.setLevel(logging.INFO)
    else:
        logger.setLevel(logging.WARNING)

    main(args.happy, args.truth, args.query)
