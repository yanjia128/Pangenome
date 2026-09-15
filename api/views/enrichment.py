import os
from collections import OrderedDict

import numpy as np
import pandas as pd
import scipy.stats
from django.core.cache import cache
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from statsmodels.stats.multitest import multipletests

ENRICHMENT_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "enrichment"
)

SPECIES_GENE_COUNT = {
    "Dbullenianum": 21913,
    "Dcariniferum": 25057,
    "Dexile": 22487,
    "Dlindleyi": 29446,  # 從gff抓出基因數為29,446，eggnog基因數為21372
    "Dnobile": 24645,
    "Dparcum": 24777,
    "Dporphyrochilum": 25812,
    "Dsecundum": 26006,
    "Dthyrsiflorum": 28696,
}

ALL_DOMAINS = ["GO", "Pathway", "pfam"]

METHOD_MAP = {
    "None": "origin_pvalue",
    "FDR": "FDR_Pvalue",
    "Bonferroni": "Bon_Pvalue",
}


def fisher_test(intersect, n_input, n_target, n_total):
    a = int(intersect)
    b = int(n_target) - a
    c = int(n_input) - a
    d = int(n_total) - a - b - c

    if min(a, b, c, d) < 0:
        return 1.0
    _, p = scipy.stats.fisher_exact([[a, b], [c, d]], alternative="greater")
    return p


def parse_input_genes(user_input):
    if not user_input:
        return []
    genes = []
    tokens = user_input.strip().replace("\r", "\n").replace(",", "\n").split("\n")
    for tok in tokens:
        g = tok.strip()
        if g:
            genes.append(g)
    return genes


def _load_domain_data(species, domain):
    """
    Read {species}_{domain}_AnnotationBrowser.csv (schema: `Query ID,Description,count,Genes`,
    shared by the GO/Pathway/pfam domains). Returns
    (search_dict: {target: [gene, ...]}, desc_dict: {target: description}, targets).

    The annotation files are static analysis outputs, so the parsed result is
    cached indefinitely per (species, domain) combination.
    """

    def _load():
        path = os.path.join(
            ENRICHMENT_DATA_DIR, species, f"{species}_{domain}_AnnotationBrowser.csv"
        )
        if not os.path.isfile(path):
            return {}, {}, []

        df = pd.read_csv(path, dtype={"Query ID": str, "Genes": str})
        if df.empty:
            return {}, {}, []

        df["_genes_list"] = (
            df["Genes"]
            .fillna("")
            .apply(lambda s: [g.strip() for g in s.split(",") if g.strip()])
        )
        search_dict = dict(zip(df["Query ID"], df["_genes_list"]))
        desc_dict = dict(zip(df["Query ID"], df["Description"].fillna("")))
        return search_dict, desc_dict, list(search_dict.keys())

    cache_key = f"enrichment_domain_v2_{species}_{domain}"
    return cache.get_or_set(cache_key, _load, timeout=None)


def _run_enrichment_unified(species, user_input, alpha, correction_method):
    if not species or species not in SPECIES_GENE_COUNT:
        return OrderedDict()

    results = OrderedDict()
    n_total_genes = SPECIES_GENE_COUNT[species]
    input_genes = parse_input_genes(user_input)
    input_set = set(input_genes)
    n_input = len(input_set)

    for domain in ALL_DOMAINS:
        search_dict, desc_dict, targets = _load_domain_data(species, domain)

        if not targets:
            results[domain] = []
            continue

        raw_data = []
        pvals_list = []

        for tgt in targets:
            target_genes = search_dict.get(tgt, [])
            n_target = len(target_genes)
            intersect_count = len(input_set.intersection(target_genes))
            p_val = fisher_test(intersect_count, n_input, n_target, n_total_genes)

            raw_data.append(
                {
                    "target": tgt,
                    "description": desc_dict.get(tgt, ""),
                    "count": intersect_count,
                    "n_target": n_target,
                    "origin_pvalue": p_val,
                }
            )
            pvals_list.append(p_val)

        if not raw_data:
            results[domain] = []
            continue

        df_res = pd.DataFrame(raw_data)

        if pvals_list:
            _, fdr, _, _ = multipletests(pvals_list, alpha=alpha, method="fdr_bh")
            _, bon, _, _ = multipletests(pvals_list, alpha=alpha, method="bonferroni")
            df_res["FDR_Pvalue"] = fdr
            df_res["Bon_Pvalue"] = bon
        else:
            df_res["FDR_Pvalue"] = 1.0
            df_res["Bon_Pvalue"] = 1.0

        input_ratio = df_res["count"] / float(n_input) if n_input > 0 else 0
        bg_ratio = df_res["n_target"] / float(n_total_genes) if n_total_genes > 0 else 0

        fold_enrichment = np.log2(input_ratio / bg_ratio.replace(0, np.nan))
        df_res["fold_enrichment"] = fold_enrichment.apply(
            lambda x: round(x, 2) if pd.notnull(x) and x != -np.inf else None
        )

        df_res["observed_ratio"] = df_res.apply(
            lambda r: "{}/{} ({:.2f}%)".format(
                r["count"], n_input, (float(r["count"]) / n_input * 100)
            )
            if n_input
            else "0/0",
            axis=1,
        )
        df_res["expected_ratio"] = df_res.apply(
            lambda r: "{}/{} ({:.2f}%)".format(
                r["n_target"],
                n_total_genes,
                (float(r["n_target"]) / n_total_genes * 100),
            )
            if n_total_genes
            else "0/0",
            axis=1,
        )

        target_col = METHOD_MAP.get(correction_method, "origin_pvalue")
        if target_col not in df_res.columns:
            target_col = "origin_pvalue"

        if alpha > 0:
            df_sel = df_res[df_res[target_col] <= alpha].copy()
        else:
            df_sel = df_res.copy()

        df_sel["p-value"] = df_sel[target_col].apply(
            lambda x: round(-np.log10(x) if x > 0 else 100, 3)
        )

        final_cols = [
            "target",
            "description",
            "p-value",
            "observed_ratio",
            "expected_ratio",
            "fold_enrichment",
            "count",
        ]
        df_sel = df_sel.sort_values("target")

        results[domain] = df_sel[final_cols].to_dict(orient="records")

    return results


class EnrichmentAnalysisEndpoint(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            if not request.body:
                return Response(
                    {"error": "Empty request body"}, status=status.HTTP_400_BAD_REQUEST
                )

            data = request.data
            species = data.get("species")
            user_input = data.get("input", "")
            correction_method = data.get("correctionMethod", "None")
            try:
                alpha = float(data.get("p_value", 0.05))
            except (TypeError, ValueError):
                alpha = 0.05

            if not species or species not in SPECIES_GENE_COUNT:
                return Response(
                    {"error": "Invalid or missing species"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            genes = parse_input_genes(user_input)
            if not genes:
                return Response(
                    {"error": "No valid gene names found in input"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            results = _run_enrichment_unified(
                species, user_input, alpha, correction_method
            )
            return Response(results, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class EnrichmentExampleGenesEndpoint(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            species = request.data.get("species")
            if not species or species not in SPECIES_GENE_COUNT:
                return Response({"geneList": []}, status=status.HTTP_400_BAD_REQUEST)

            path = os.path.join(
                ENRICHMENT_DATA_DIR, species, f"{species}_pfam_AnnotationBrowser.csv"
            )
            if not os.path.isfile(path):
                return Response({"geneList": []}, status=status.HTTP_404_NOT_FOUND)

            df = pd.read_csv(path, dtype=str)
            if df.empty:
                return Response({"geneList": []}, status=status.HTTP_200_OK)

            genes_str = df.loc[df["Genes"].fillna("").str.len().idxmax(), "Genes"]
            genes = sorted({g.strip() for g in genes_str.split(",") if g.strip()})
            return Response({"geneList": genes}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
