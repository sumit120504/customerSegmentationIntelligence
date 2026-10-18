# Customer Segmentation Intelligence Dashboard (RFM + K-Means)

An end-to-end e-commerce customer segmentation platform built with **Python (Scikit-Learn, Pandas)** and an **interactive web dashboard (HTML5, CSS3, Vanilla JS, Chart.js)** with zero backend dependencies.

The project analyzes customer transaction history from the **UCI Online Retail II dataset** spanning over 1 million transactions between 2009 and 2011 to uncover customer behavioral archetypes, evaluate customer lifetime value, and deliver actionable marketing strategies.

---

## 📊 Project Architecture

```
customer-segmentation-dashboard/
├── notebooks/      # Python: cleaning, EDA, modeling, evaluation
│   └── customer_segmentation.ipynb   # Executed Jupyter Notebook with inline plots & analysis
├── backend/        # FastAPI (only for projects 2 and 3)
│   └── README.md                     # Backend note (Project 1 is static, zero backend)
├── frontend/       # index.html, style.css, script.js
│   ├── index.html                    # Dashboard UI & responsive layout
│   ├── style.css                     # Dark/light theme design system & animations
│   └── script.js                     # Unified controller (Chart.js + state + table + search)
├── data/           # raw data, plus exported JSON for the frontend
│   ├── online_retail_II.xlsx         # Raw UCI Online Retail II dataset
│   ├── online_retail_II.parquet      # High-speed parquet cache (1M+ rows)
│   ├── customers.json                # 5,878 customers with R, F, M, Segment & PCA coords
│   ├── segments.json                 # Per-segment size, avg R/F/M, revenue share & recommendations
│   ├── monthly_sales.json            # 25-month historical revenue trend
│   └── evaluation.json               # Elbow & silhouette scores for K=2..8
├── scripts/                          # Automation scripts
│   ├── process_segmentation.py       # Standalone pipeline script
│   ├── build_notebook.py             # Notebook generator
│   └── download_data.py              # Dataset downloader
├── reports/                          # Visual evaluation figures (PNG)
│   ├── elbow_silhouette_plot.png
│   ├── rfm_distributions.png
│   ├── pca_clusters.png
│   └── monthly_revenue.png
├── requirements.txt                  # Python dependencies
└── vercel.json                       # Deployment configuration
```

---

## 🧠 Part A: Machine Learning Methodology

### 1. Data Cleaning
From an initial **1,067,371 raw transaction records**, the dataset was cleaned according to strict data hygiene rules:
- **Missing Customer IDs:** 243,007 rows dropped (anonymous guest transactions without customer identification).
- **Cancelled Invoices:** 18,744 rows dropped (identified by invoices beginning with `"C"`).
- **Invalid Quantities & Prices:** 71 rows dropped ($\text{Quantity} \le 0$ or $\text{Price} \le 0$).
- **Duplicates:** 26,124 duplicate transaction records eliminated.
- **TotalPrice Feature:** Created as $\text{Quantity} \times \text{Price}$.
- **Final Cleaned Transactions:** **779,425 records** (73.0% of raw data retained).

### 2. RFM Feature Engineering
Aggregated at the individual customer level for **5,878 unique active customers**:
- **Recency ($R$):** Elapsed days from customer's latest purchase to analysis reference date (`2011-12-10 12:50:00`, 1 day after the latest recorded invoice). Lower values indicate recent brand engagement.
- **Frequency ($F$):** Total count of unique orders/invoices placed by the customer.
- **Monetary ($M$):** Total cumulative expenditure (£) across all transactions.

### 3. Preprocessing: Log-Transformation & Standardization
- **Logarithmic Transformation:** Raw $R$, $F$, and $M$ exhibit heavy positive right-skewness (skewness coefficients: $R = 1.05$, $F = 15.65$, $M = 23.47$). Applying logarithmic transformation ($x_{\text{log}} = \ln(x)$) stabilizes feature variance and normalizes distributions.
- **Standardization:** Normalized via `StandardScaler` ($z = \frac{x - \mu}{\sigma}$) so Euclidean distance calculations in K-Means weigh all three dimensions equally.

### 4. Selecting Optimal $K$: Elbow Method & Silhouette Analysis

| Clusters ($K$) | Inertia (WCSS) | Silhouette Score |
| :---: | :---: | :---: |
| $K=2$ | 8,542.44 | 0.4365 |
| $K=3$ | 6,342.18 | 0.3421 |
| **$K=4$** | **4,964.35** | **0.3610** (Local peak) |
| $K=5$ | 4,178.66 | 0.3399 |
| $K=6$ | 3,614.11 | 0.3380 |
| $K=7$ | 3,253.49 | 0.3105 |
| $K=8$ | 2,940.47 | 0.3141 |

#### Mathematical & Business Justification for $K=4$:
1. **Elbow Inflection Point:** The reduction in within-cluster sum-of-squares (inertia) exhibits a pronounced elbow bend at $K=4$. Increasing beyond $K=4$ produces diminishing marginal returns.
2. **Silhouette Peak:** $K=4$ attains a strong local maximum ($0.3610$), outperforming $K=3, 5, 6, 7, 8$.
3. **Marketing Personas:** $K=4$ cleanly maps the customer base into four natural, operationally distinct lifecycle stages (**Champions**, **Loyal**, **At Risk**, **Lost**) without unnecessary cohort fragmentation.

---

## 👥 Customer Segment Personas & Strategic Recommendations

| Segment | Customers | Customer % | Avg Recency | Avg Frequency | Avg Spend | Total Revenue | Revenue Share |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 🟢 **Champions** | 1,218 | 20.72% | 26.9 days | 19.0 orders | £10,587.87 | £12,896,021 | **74.22%** |
| 🔵 **Loyal** | 1,150 | 19.56% | 27.1 days | 3.1 orders | £840.87 | £966,997 | **5.57%** |
| 🟡 **At Risk** | 1,547 | 26.32% | 232.6 days | 5.0 orders | £1,874.04 | £2,899,144 | **16.69%** |
| 🔴 **Lost** | 1,963 | 33.40% | 386.9 days | 1.3 orders | £312.09 | £612,642 | **3.53%** |

### Strategic Playbooks:
- 🟢 **Champions (74.2% Revenue):** High-frequency, high-value brand advocates.
  - *Recommendation:* Provide VIP access, dedicated account support, early access to new product lines, and referral incentives to maximize customer lifetime value.
- 🔵 **Loyal (19.6% Base):** Recent buyers with steady recurring orders.
  - *Recommendation:* Upsell product bundles, introduce tiered loyalty rewards, and set spend milestone discounts to graduate them into Champions.
- 🟡 **At Risk (16.7% Revenue at stake):** Previously active repeat buyers who haven't purchased in over 7 months.
  - *Recommendation:* Trigger automated "We miss you" win-back email workflows, provide time-limited reactivation discounts, and gather product/service satisfaction feedback.
- 🔴 **Lost (33.4% Base):** Inactive for over a year with minimal lifetime value.
  - *Recommendation:* Minimize direct advertising budget; engage passively through quarterly seasonal clearance newsletters and automated low-cost reactivation campaigns.

---

## 💻 Part B: Frontend Web Dashboard

The static frontend is built with pure HTML5, CSS3, Vanilla ES6 JavaScript, and Chart.js, requiring **no Node.js build step or backend API**.

### Key Features:
1. **Interactive KPI Metrics:** Dynamic summary cards showcasing Total Customers (5,878), Cumulative Spend (£17.37M), Average Customer Spend (£2,955.90), Average Recency (201 days), and Champions Revenue Share (74.2%).
2. **Interactive Segment Action Cards:** Cards displaying customer counts, revenue progress bars, average R/F/M metrics, and strategic recommendations. Clicking any card filters the entire dashboard.
3. **Chart Visualizations (Chart.js):**
   - **PCA Scatter Plot:** 2D projection of standardized log(RFM) features ($95.2\%$ variance captured) colored by segment, with hover tooltips displaying Customer ID, Recency, Frequency, and Spend.
   - **Segment Distribution Doughnut:** Proportions of customer counts per segment with slice-filtering interactivity.
   - **Revenue vs Avg Spend Bar Chart:** Contrasts aggregate revenue contribution against average individual customer spend.
   - **Monthly Sales Line Chart:** 25-month historical revenue trend with smooth gradient fill.
4. **Customer Intelligence Explorer Table:**
   - Real-time search by Customer ID with dropdown suggestions.
   - Sortable columns (Customer ID, Segment, Recency, Frequency, Spend, PCA coords).
   - Paginated table with configurable page sizes (10, 25, 50, 100) and quick page navigation.
5. **Customer Profile Modal:**
   - Interactive pop-up triggered by table rows, scatter plot points, or direct search.
   - Compares customer's individual R, F, and M metrics against their segment's benchmarks.
6. **Dark / Light Mode:** High-contrast themes with persistent state saved in `localStorage`.
7. **CSV Data Export:** One-click client-side CSV export of currently filtered customers.
