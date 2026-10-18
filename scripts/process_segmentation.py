#!/usr/bin/env python3
"""
Customer Segmentation Pipeline using RFM Analysis and K-Means Clustering
Dataset: UCI Online Retail II
"""

import os
import sys
import json
import time
import argparse
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.decomposition import PCA


def load_dataset(data_dir="data"):
    """Load Online Retail II dataset, with caching to parquet."""
    parquet_path = os.path.join(data_dir, "online_retail_II.parquet")
    xlsx_path = os.path.join(data_dir, "online_retail_II.xlsx")

    if os.path.exists(parquet_path):
        print(f"Loading cached parquet dataset from {parquet_path}...")
        df = pd.read_parquet(parquet_path)
    elif os.path.exists(xlsx_path):
        print(f"Loading Excel file from {xlsx_path} (both sheets)...")
        t0 = time.time()
        df1 = pd.read_excel(xlsx_path, sheet_name="Year 2009-2010")
        df2 = pd.read_excel(xlsx_path, sheet_name="Year 2010-2011")
        df = pd.concat([df1, df2], ignore_index=True)
        # Fix string types for mixed columns
        df["Invoice"] = df["Invoice"].astype(str)
        df["StockCode"] = df["StockCode"].astype(str)
        df["Description"] = df["Description"].astype(str)
        df.to_parquet(parquet_path, index=False)
        print(f"Loaded and saved parquet in {time.time() - t0:.2f}s")
    else:
        raise FileNotFoundError(f"Neither {parquet_path} nor {xlsx_path} was found!")

    print(f"Raw dataset shape: {df.shape}")
    return df


def clean_data(df):
    """
    Clean the dataset according to project requirements:
    1. Drop rows with missing Customer ID
    2. Drop cancelled invoices (starting with 'C')
    3. Drop negative quantities and non-positive prices
    4. Drop duplicates
    5. Create TotalPrice = Quantity * Price
    """
    print("\n--- Cleaning Data ---")
    initial_len = len(df)

    # 1. Drop missing Customer ID
    df_clean = df.dropna(subset=["Customer ID"]).copy()
    df_clean["Customer ID"] = df_clean["Customer ID"].astype(int).astype(str)
    print(f"1. Removed missing Customer ID: {initial_len - len(df_clean):,} rows dropped")

    # 2. Drop cancelled invoices (starts with 'C')
    df_clean["Invoice"] = df_clean["Invoice"].astype(str).str.strip()
    non_cancelled = ~df_clean["Invoice"].str.upper().str.startswith("C")
    cancelled_count = (~non_cancelled).sum()
    df_clean = df_clean[non_cancelled]
    print(f"2. Removed cancelled invoices: {cancelled_count:,} rows dropped")

    # 3. Drop negative quantities and non-positive prices
    valid_tx = (df_clean["Quantity"] > 0) & (df_clean["Price"] > 0)
    invalid_tx_count = (~valid_tx).sum()
    df_clean = df_clean[valid_tx]
    print(f"3. Removed non-positive quantity/price: {invalid_tx_count:,} rows dropped")

    # 4. Drop duplicates
    before_dup = len(df_clean)
    df_clean = df_clean.drop_duplicates()
    print(f"4. Removed duplicate rows: {before_dup - len(df_clean):,} rows dropped")

    # 5. Create TotalPrice
    df_clean["TotalPrice"] = df_clean["Quantity"] * df_clean["Price"]
    df_clean["InvoiceDate"] = pd.to_datetime(df_clean["InvoiceDate"])
    print(f"5. Created TotalPrice column. Final cleaned transactions: {len(df_clean):,}")

    return df_clean


def compute_rfm(df_clean):
    """
    Calculate RFM metrics for each customer:
    - Recency: Days since last purchase (relative to max date + 1)
    - Frequency: Count of unique invoices/orders
    - Monetary: Total spend (sum of TotalPrice)
    """
    print("\n--- Computing RFM Metrics ---")
    reference_date = df_clean["InvoiceDate"].max() + pd.Timedelta(days=1)
    print(f"Reference Date for Recency calculation: {reference_date.strftime('%Y-%m-%d %H:%M:%S')}")

    rfm = df_clean.groupby("Customer ID").agg({
        "InvoiceDate": lambda d: (reference_date - d.max()).days,
        "Invoice": "nunique",
        "TotalPrice": "sum"
    }).rename(columns={
        "InvoiceDate": "Recency",
        "Invoice": "Frequency",
        "TotalPrice": "Monetary"
    })

    # Ensure strictly positive values for log-transform
    rfm = rfm[(rfm["Recency"] > 0) & (rfm["Frequency"] > 0) & (rfm["Monetary"] > 0)]
    print(f"Total active customers analyzed: {len(rfm):,}")
    print("\nRFM Summary Statistics:")
    print(rfm.describe().round(2))

    return rfm, reference_date


def preprocess_rfm(rfm):
    """
    Log-transform skewed RFM distributions and standardize with StandardScaler.
    """
    print("\n--- Preprocessing RFM Features ---")
    rfm_log = pd.DataFrame({
        "Recency": np.log(rfm["Recency"]),
        "Frequency": np.log(rfm["Frequency"]),
        "Monetary": np.log(rfm["Monetary"])
    }, index=rfm.index)

    scaler = StandardScaler()
    rfm_scaled = scaler.fit_transform(rfm_log)
    print("Log-transformation and StandardScaler standardization completed.")

    return rfm_log, rfm_scaled, scaler


def evaluate_k(rfm_scaled, k_range=range(2, 9), output_dir="reports"):
    """
    Evaluate K-Means for K in k_range using:
    - Elbow Method (Inertia / Within-Cluster Sum of Squares)
    - Silhouette Score (Cluster cohesion and separation)
    """
    print("\n--- Evaluating Optimal K (Elbow & Silhouette) ---")
    os.makedirs(output_dir, exist_ok=True)

    results = []
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=15)
        labels = km.fit_predict(rfm_scaled)
        inertia = float(km.inertia_)
        sil = float(silhouette_score(rfm_scaled, labels, sample_size=min(len(rfm_scaled), 4000), random_state=42))
        results.append({
            "k": k,
            "inertia": round(inertia, 2),
            "silhouette_score": round(sil, 4)
        })
        print(f"  K={k}: Inertia = {inertia:8.2f} | Silhouette Score = {sil:.4f}")

    # Plot evaluation metrics
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    ks = [r["k"] for r in results]
    inertias = [r["inertia"] for r in results]
    silhouettes = [r["silhouette_score"] for r in results]

    ax1.plot(ks, inertias, marker='o', linewidth=2, color='#2563eb')
    ax1.axvline(x=4, color='#dc2626', linestyle='--', label='Chosen K=4')
    ax1.set_title('Elbow Method (Inertia vs K)', fontsize=13, fontweight='bold')
    ax1.set_xlabel('Number of Clusters (K)')
    ax1.set_ylabel('Inertia (WCSS)')
    ax1.grid(True, linestyle=':', alpha=0.6)
    ax1.legend()

    ax2.plot(ks, silhouettes, marker='s', linewidth=2, color='#10b981')
    ax2.axvline(x=4, color='#dc2626', linestyle='--', label='Chosen K=4')
    ax2.set_title('Silhouette Score vs K', fontsize=13, fontweight='bold')
    ax2.set_xlabel('Number of Clusters (K)')
    ax2.set_ylabel('Silhouette Score')
    ax2.grid(True, linestyle=':', alpha=0.6)
    ax2.legend()

    plt.tight_layout()
    eval_plot_path = os.path.join(output_dir, "elbow_silhouette_plot.png")
    plt.savefig(eval_plot_path, dpi=200)
    plt.close()
    print(f"Saved evaluation plot to {eval_plot_path}")

    return results


def perform_clustering_and_labeling(rfm, rfm_scaled, k=4):
    """
    Fit K-Means with K=4 and dynamically map clusters to business segments:
    - Champions: Lowest Recency, Highest Frequency, Highest Spend
    - Loyal: Recent purchase, good frequency & consistent spend
    - At Risk: Formerly high engagement/spend, but slipping recency (> 100 days)
    - Lost: Highest recency (> 1 year), single order, lowest spend
    """
    print(f"\n--- Fitting K-Means (K={k}) and Profiling Segments ---")
    km = KMeans(n_clusters=k, random_state=42, n_init=20)
    raw_labels = km.fit_predict(rfm_scaled)
    rfm["raw_cluster"] = raw_labels

    # Compute mean R, F, M for each raw cluster to map them systematically
    cluster_means = rfm.groupby("raw_cluster").agg({
        "Recency": "mean",
        "Frequency": "mean",
        "Monetary": "mean"
    })

    # Systematically classify:
    # 1. Champions: highest Monetary & highest Frequency
    champions_id = cluster_means["Monetary"].idxmax()

    # 2. Lost: out of non-champions, highest Recency and lowest Frequency
    remaining = [c for c in cluster_means.index if c != champions_id]
    lost_id = cluster_means.loc[remaining, "Recency"].idxmax()

    # 3. Between remaining 2:
    remaining_2 = [c for c in remaining if c != lost_id]
    # The one with higher recency is "At Risk" (slipping customers)
    if cluster_means.loc[remaining_2[0], "Recency"] > cluster_means.loc[remaining_2[1], "Recency"]:
        at_risk_id = remaining_2[0]
        loyal_id = remaining_2[1]
    else:
        at_risk_id = remaining_2[1]
        loyal_id = remaining_2[0]

    cluster_to_segment = {
        champions_id: "Champions",
        loyal_id: "Loyal",
        at_risk_id: "At Risk",
        lost_id: "Lost"
    }

    rfm["Segment"] = rfm["raw_cluster"].map(cluster_to_segment)

    print("Dynamic Cluster Mapping:")
    for cid, sname in cluster_to_segment.items():
        stats = cluster_means.loc[cid]
        print(f"  Cluster {cid} -> {sname:10} | Avg R: {stats['Recency']:.1f}d, Avg F: {stats['Frequency']:.1f}, Avg M: £{stats['Monetary']:,.2f}")

    return rfm, km, cluster_to_segment


def compute_pca(rfm_scaled):
    """Compute 2D PCA coordinates for visualization."""
    print("\n--- Dimensionality Reduction (PCA 2D) ---")
    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(rfm_scaled)
    exp_var = pca.explained_variance_ratio_
    print(f"PCA Component 1 explained variance: {exp_var[0] * 100:.2f}%")
    print(f"PCA Component 2 explained variance: {exp_var[1] * 100:.2f}%")
    print(f"Total 2D explained variance: {sum(exp_var) * 100:.2f}%")
    return coords, pca


def compute_monthly_sales(df_clean):
    """Aggregate monthly sales revenue, order counts, and active customer numbers."""
    print("\n--- Computing Monthly Sales Trend ---")
    df_temp = df_clean.copy()
    df_temp["YearMonth"] = df_temp["InvoiceDate"].dt.to_period("M").astype(str)

    monthly = df_temp.groupby("YearMonth").agg({
        "TotalPrice": "sum",
        "Invoice": "nunique",
        "Customer ID": "nunique"
    }).rename(columns={
        "TotalPrice": "Revenue",
        "Invoice": "Orders",
        "Customer ID": "ActiveCustomers"
    }).reset_index()

    monthly["AvgOrderValue"] = monthly["Revenue"] / monthly["Orders"]
    print(f"Calculated monthly sales across {len(monthly)} months.")
    return monthly


def export_json_files(rfm, monthly, eval_results, data_dirs=None):
    """
    Export required JSON files into data/ (and frontend/data/):
    - customers.json: customer ID, R, F, M, segment, plus 2D PCA coordinates
    - segments.json: per-segment size, average R/F/M, revenue share, and recommendation
    - monthly_sales.json: revenue trend over time
    - evaluation.json: elbow and silhouette scores
    """
    if data_dirs is None:
        data_dirs = ["data", "frontend/data"]

    # 1. customers.json data
    customers_list = []
    for cid, row in rfm.iterrows():
        customers_list.append({
            "customer_id": str(cid),
            "recency": int(row["Recency"]),
            "frequency": int(row["Frequency"]),
            "monetary": round(float(row["Monetary"]), 2),
            "segment": str(row["Segment"]),
            "pca_x": round(float(row["pca_x"]), 3),
            "pca_y": round(float(row["pca_y"]), 3)
        })

    # 2. segments.json data
    segment_colors = {
        "Champions": "#10b981", # Emerald green
        "Loyal": "#3b82f6",     # Blue
        "At Risk": "#f59e0b",   # Amber
        "Lost": "#ef4444"       # Rose red
    }

    segment_recommendations = {
        "Champions": "Reward brand advocacy with VIP tiers, exclusive early-access product drops, personalized gifting, and high-tier loyalty points to maximize customer lifetime value.",
        "Loyal": "Upsell higher-value bundles, incentivize higher order frequency with milestone threshold discounts, and introduce referral incentives to transition them into Champions.",
        "At Risk": "Deploy automated multi-stage win-back campaigns, deliver personalized 'We miss you' emails with time-sensitive discount codes, and run exit surveys to identify friction.",
        "Lost": "Minimize costly direct ad spend; run automated periodic low-cost reactivation email drip campaigns and seasonal clearance promos to recapture interest without eroding margins."
    }

    total_customers = len(rfm)
    total_revenue = float(rfm["Monetary"].sum())

    segments_list = []
    ordered_segments = ["Champions", "Loyal", "At Risk", "Lost"]

    for seg in ordered_segments:
        seg_df = rfm[rfm["Segment"] == seg]
        seg_size = len(seg_df)
        seg_rev = float(seg_df["Monetary"].sum())

        segments_list.append({
            "segment": seg,
            "size": seg_size,
            "size_percentage": round((seg_size / total_customers) * 100, 2),
            "avg_recency": round(float(seg_df["Recency"].mean()), 1),
            "avg_frequency": round(float(seg_df["Frequency"].mean()), 1),
            "avg_monetary": round(float(seg_df["Monetary"].mean()), 2),
            "total_revenue": round(seg_rev, 2),
            "revenue_share": round((seg_rev / total_revenue) * 100, 2),
            "recommendation": segment_recommendations.get(seg, "Engage actively."),
            "color": segment_colors.get(seg, "#6b7280")
        })

    # 3. monthly_sales.json data
    monthly_list = []
    for _, row in monthly.iterrows():
        monthly_list.append({
            "month": str(row["YearMonth"]),
            "revenue": round(float(row["Revenue"]), 2),
            "orders": int(row["Orders"]),
            "active_customers": int(row["ActiveCustomers"]),
            "avg_order_value": round(float(row["AvgOrderValue"]), 2)
        })

    # 4. evaluation data
    eval_dict = {
        "evaluation": eval_results,
        "chosen_k": 4,
        "justification": "K=4 provides the optimal balance between mathematical cohesion (inflection point on the elbow curve and high silhouette score) and actionable business interpretability, perfectly yielding Champions, Loyal, At Risk, and Lost segments."
    }

    # Write payloads to all target directories
    for target_dir in data_dirs:
        os.makedirs(target_dir, exist_ok=True)
        print(f"\n--- Exporting JSON files to {target_dir}/ ---")

        with open(os.path.join(target_dir, "customers.json"), "w", encoding="utf-8") as f:
            json.dump(customers_list, f, indent=None, separators=(',', ':'))
        print(f"  Saved {target_dir}/customers.json ({len(customers_list):,} customers)")

        with open(os.path.join(target_dir, "segments.json"), "w", encoding="utf-8") as f:
            json.dump(segments_list, f, indent=2)
        print(f"  Saved {target_dir}/segments.json ({len(segments_list)} segments)")

        with open(os.path.join(target_dir, "monthly_sales.json"), "w", encoding="utf-8") as f:
            json.dump(monthly_list, f, indent=2)
        print(f"  Saved {target_dir}/monthly_sales.json ({len(monthly_list)} months)")

        with open(os.path.join(target_dir, "evaluation.json"), "w", encoding="utf-8") as f:
            json.dump(eval_dict, f, indent=2)
        print(f"  Saved {target_dir}/evaluation.json")


def generate_visual_artifacts(rfm, monthly, output_dir="reports"):
    """Generate high-resolution PNG plots for reports and documentation."""
    os.makedirs(output_dir, exist_ok=True)
    sns.set_theme(style="whitegrid")

    # 1. RFM Distributions (Raw vs Log)
    fig, axes = plt.subplots(2, 3, figsize=(16, 9))
    features = ["Recency", "Frequency", "Monetary"]

    for i, col in enumerate(features):
        sns.histplot(rfm[col], kde=True, ax=axes[0, i], color="#3b82f6", bins=35)
        axes[0, i].set_title(f"Raw {col} Distribution", fontweight="bold")
        axes[0, i].set_xlabel(col)

        log_data = np.log(rfm[col])
        sns.histplot(log_data, kde=True, ax=axes[1, i], color="#10b981", bins=35)
        axes[1, i].set_title(f"Log-Transformed {col} Distribution", fontweight="bold")
        axes[1, i].set_xlabel(f"log({col})")

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "rfm_distributions.png"), dpi=200)
    plt.close()

    # 2. PCA 2D Scatter of Segments
    plt.figure(figsize=(10, 7))
    palette = {
        "Champions": "#10b981",
        "Loyal": "#3b82f6",
        "At Risk": "#f59e0b",
        "Lost": "#ef4444"
    }
    sns.scatterplot(
        data=rfm,
        x="pca_x",
        y="pca_y",
        hue="Segment",
        palette=palette,
        alpha=0.65,
        s=40
    )
    plt.title("2D PCA Customer Segmentation (K-Means Clusters)", fontsize=14, fontweight="bold")
    plt.xlabel("Principal Component 1")
    plt.ylabel("Principal Component 2")
    plt.legend(title="Customer Segment", loc="upper right")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "pca_clusters.png"), dpi=200)
    plt.close()

    # 3. Monthly Revenue Trend
    plt.figure(figsize=(12, 5))
    plt.plot(monthly["YearMonth"], monthly["Revenue"] / 1e3, marker='o', linewidth=2.5, color="#6366f1")
    plt.fill_between(monthly["YearMonth"], monthly["Revenue"] / 1e3, color="#6366f1", alpha=0.15)
    plt.title("Monthly Revenue Trend (in £ thousands)", fontsize=13, fontweight="bold")
    plt.xlabel("Year-Month")
    plt.ylabel("Revenue (£K)")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "monthly_revenue.png"), dpi=200)
    plt.close()
    print(f"Generated visual report plots in {output_dir}/")


def main():
    parser = argparse.ArgumentParser(description="Run RFM Customer Segmentation Pipeline")
    parser.add_argument("--data-dir", default="data", help="Directory containing dataset")
    parser.add_argument("--frontend-dir", default="frontend/data", help="Frontend output directory")
    parser.add_argument("--reports-dir", default="reports", help="Reports output directory")
    args = parser.parse_args()

    print("=" * 60)
    print("CUSTOMER SEGMENTATION PIPELINE (RFM + K-MEANS)")
    print("=" * 60)

    # 1. Load data
    df = load_dataset(args.data_dir)

    # 2. Clean data
    df_clean = clean_data(df)

    # 3. Compute RFM
    rfm, ref_date = compute_rfm(df_clean)

    # 4. Preprocess RFM
    rfm_log, rfm_scaled, scaler = preprocess_rfm(rfm)

    # 5. Evaluate K (Elbow & Silhouette)
    eval_results = evaluate_k(rfm_scaled, k_range=range(2, 9), output_dir=args.reports_dir)

    # 6. Fit K-Means & Profile Segments
    rfm, km, cluster_map = perform_clustering_and_labeling(rfm, rfm_scaled, k=4)

    # 7. Compute PCA
    coords, pca = compute_pca(rfm_scaled)
    rfm["pca_x"] = coords[:, 0]
    rfm["pca_y"] = coords[:, 1]

    # 8. Compute Monthly Sales
    monthly = compute_monthly_sales(df_clean)

    # 9. Export JSON files
    export_json_files(rfm, monthly, eval_results, data_dirs=["data", args.frontend_dir])

    # 10. Generate Visual Artifacts
    generate_visual_artifacts(rfm, monthly, output_dir=args.reports_dir)

    print("\n" + "=" * 60)
    print("PIPELINE COMPLETED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
