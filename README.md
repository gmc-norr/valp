# valp

Valp is a small variant validation pipeline.
The purpose of the pipeline is to take one or more pairs of VCF files where each pair represents a truth set and a query set of variants.

The pipeline is written in Nextflow, and has taken quite a lot of inspiration from the nf-core way of doing things.
It is not an nf-core pipeline, however.

## Running the pipeline

```bash
nextflow run gmc-norr/valp --input comparisons.csv --liftover_plugin LIFTOVER_PLUGIN_PATH [OPTIONS]
```

The parameter `--liftover_plugin` should be the path to the bcftools liftover plugin.
See <https://github.com/freeseek/score> for more information on how to obtain this plugin.

See below what is needed as input and configuration.

## Input

A CSV file containing the files to compare must be created.

```csv
truthset,truthset_genome,queryset,queryset_genome,conf_regions,limit_regions
truthset.vcf.gz,GRCh38,queryset.vcf.gz,GRCh38,benchmark_regions.bed,limit_regions.bed
```

Column          | Required | Description
----------------|----------|-------------
truthset        | ✔        | A VCF file with the truth set of variants to compare against
truthset_genome | ✔        | The genome that the truth set of variants represent
queryset        | ✔        | A VCF file with the query set of variants to validate
queryset_genome | ✔        | The genome that the query set of variants represent
conf_regions    |          | High-confidence regions based on the query set genome that should be used for benchmarking
limit_regions   |          | Regions based on the query set genome that the comparison should be limited to, e.g. when validating exome or panel data

## Configuration

Genome reference files are requested dynamically based on the input.
Each genome defined in the input needs to have a fasta file and a corresponding index.
These are defined as parameters like this (yaml):

```yaml
params.references.GRCh38.fasta = /path/to/grch38.fasta
params.references.GRCh38.fai = /path/to/grch38.fasta.fai
```

If `truthset_genome` is different from `queryset_genome`, then chainfiles also need to be supplied.
If they differ, a lift-over of the truth-set will be performed, and thus a chain file for lifting over from `truthset_genome` to `queryset_genome` needs to be defined.
This can be defined like this (yaml):

```yaml
params.chainfiles.GRCh37.GRCh38 = /path/to/GRCh37_to_GRCh38.chain
```

This particular example will then be used if the truth set is defined as GRCh37 and the query set is defined as GRCh38.
