/**
 * script.js - Customer Segmentation Dashboard (Charts + App State Controller)
 */

/* ==========================================================================
   Chart Manager (Chart.js Visualizations)
   ========================================================================== */

class DashboardCharts {
  constructor() {
    this.scatterChart = null;
    this.doughnutChart = null;
    this.revenueBarChart = null;
    this.monthlySalesChart = null;

    this.segmentColors = {
      "Champions": "#10b981",
      "Loyal": "#3b82f6",
      "At Risk": "#f59e0b",
      "Lost": "#ef4444"
    };

    this.segmentBackgrounds = {
      "Champions": "rgba(16, 185, 129, 0.75)",
      "Loyal": "rgba(59, 130, 246, 0.75)",
      "At Risk": "rgba(245, 158, 11, 0.75)",
      "Lost": "rgba(239, 68, 68, 0.75)"
    };
  }

  getThemeColors(isDark) {
    return {
      text: isDark ? "#94a3b8" : "#475569",
      grid: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(226, 232, 240, 0.8)",
      tooltipBg: isDark ? "#1f2937" : "#0f172a",
      tooltipText: "#ffffff"
    };
  }

  /**
   * 1. 2D PCA Cluster Scatter Plot
   */
  initScatterPlot(canvasId, customers, onPointClick) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const theme = this.getThemeColors(isDark);

    const segments = ["Champions", "Loyal", "At Risk", "Lost"];
    const datasets = segments.map(seg => {
      const segPoints = customers
        .filter(c => c.segment === seg)
        .map(c => ({
          x: c.pca_x,
          y: c.pca_y,
          customer_id: c.customer_id,
          recency: c.recency,
          frequency: c.frequency,
          monetary: c.monetary,
          segment: c.segment
        }));

      return {
        label: seg,
        data: segPoints,
        backgroundColor: this.segmentBackgrounds[seg],
        borderColor: this.segmentColors[seg],
        borderWidth: 1,
        pointRadius: 3.5,
        pointHoverRadius: 6.5
      };
    });

    this.scatterChart = new Chart(ctx, {
      type: "scatter",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: {
          legend: {
            position: "top",
            labels: {
              color: theme.text,
              usePointStyle: true,
              pointStyle: "circle",
              padding: 14,
              font: { size: 12, weight: "600" }
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              title: (items) => {
                if (!items.length) return "";
                const pt = items[0].raw;
                return `Customer ID: #${pt.customer_id}`;
              },
              label: (item) => {
                const pt = item.raw;
                return [
                  `Segment: ${pt.segment}`,
                  `Recency: ${pt.recency} days ago`,
                  `Frequency: ${pt.frequency} orders`,
                  `Monetary: £${pt.monetary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  `PCA: (${pt.x}, ${pt.y})`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Principal Component 1 (76.4% Variance)",
              color: theme.text,
              font: { size: 11, weight: "600" }
            },
            grid: { color: theme.grid },
            ticks: { color: theme.text }
          },
          y: {
            title: {
              display: true,
              text: "Principal Component 2 (18.8% Variance)",
              color: theme.text,
              font: { size: 11, weight: "600" }
            },
            grid: { color: theme.grid },
            ticks: { color: theme.text }
          }
        },
        onClick: (evt, activeElements) => {
          if (activeElements.length > 0 && onPointClick) {
            const first = activeElements[0];
            const datasetIndex = first.datasetIndex;
            const index = first.index;
            const clickedCustomer = this.scatterChart.data.datasets[datasetIndex].data[index];
            onPointClick(clickedCustomer);
          }
        }
      }
    });

    return this.scatterChart;
  }

  filterScatter(activeSegment) {
    if (!this.scatterChart) return;
    this.scatterChart.data.datasets.forEach(ds => {
      ds.hidden = !(activeSegment === "All" || ds.label === activeSegment);
    });
    this.scatterChart.update();
  }

  /**
   * 2. Doughnut Chart: Segment Sizes
   */
  initDoughnutChart(canvasId, segments, onSegmentClick) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const theme = this.getThemeColors(isDark);

    const labels = segments.map(s => s.segment);
    const data = segments.map(s => s.size);
    const bgColors = segments.map(s => this.segmentColors[s.segment]);

    this.doughnutChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: isDark ? "#111827" : "#ffffff",
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: theme.text,
              usePointStyle: true,
              padding: 16,
              font: { size: 12, weight: "500" }
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (item) => {
                const seg = segments[item.dataIndex];
                return ` ${seg.size.toLocaleString()} customers (${seg.size_percentage}%)`;
              }
            }
          }
        },
        onClick: (evt, activeElements) => {
          if (activeElements.length > 0 && onSegmentClick) {
            const index = activeElements[0].index;
            onSegmentClick(labels[index]);
          }
        }
      }
    });

    return this.doughnutChart;
  }

  /**
   * 3. Bar Chart: Revenue Share & Average Spend by Segment
   */
  initRevenueBarChart(canvasId, segments, onSegmentClick) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const theme = this.getThemeColors(isDark);

    const labels = segments.map(s => s.segment);
    const revenues = segments.map(s => +(s.total_revenue / 1e6).toFixed(2));
    const avgSpends = segments.map(s => s.avg_monetary);

    this.revenueBarChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Total Revenue (£ Millions)",
            data: revenues,
            backgroundColor: segments.map(s => this.segmentColors[s.segment]),
            borderRadius: 6,
            yAxisID: "y"
          },
          {
            label: "Avg Spend / Customer (£)",
            data: avgSpends,
            type: "line",
            borderColor: isDark ? "#38bdf8" : "#0284c7",
            backgroundColor: isDark ? "#38bdf8" : "#0284c7",
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7,
            yAxisID: "y1"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: {
              color: theme.text,
              usePointStyle: true,
              font: { size: 12, weight: "500" }
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (item) => {
                if (item.datasetIndex === 0) {
                  const seg = segments[item.dataIndex];
                  return ` Total Revenue: £${seg.total_revenue.toLocaleString()} (${seg.revenue_share}% share)`;
                } else {
                  return ` Avg Customer Spend: £${item.raw.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.text, font: { weight: "600" } }
          },
          y: {
            type: "linear",
            position: "left",
            title: {
              display: true,
              text: "Total Revenue (£M)",
              color: theme.text,
              font: { size: 11, weight: "600" }
            },
            grid: { color: theme.grid },
            ticks: {
              color: theme.text,
              callback: val => `£${val}M`
            }
          },
          y1: {
            type: "linear",
            position: "right",
            title: {
              display: true,
              text: "Avg Spend (£)",
              color: theme.text,
              font: { size: 11, weight: "600" }
            },
            grid: { drawOnChartArea: false },
            ticks: {
              color: theme.text,
              callback: val => `£${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`
            }
          }
        },
        onClick: (evt, activeElements) => {
          if (activeElements.length > 0 && onSegmentClick) {
            const index = activeElements[0].index;
            onSegmentClick(labels[index]);
          }
        }
      }
    });

    return this.revenueBarChart;
  }

  /**
   * 4. Line Chart: Monthly Sales Trend
   */
  initMonthlySalesChart(canvasId, monthlySales) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const theme = this.getThemeColors(isDark);

    const labels = monthlySales.map(m => m.month);
    const revenues = monthlySales.map(m => +(m.revenue / 1000).toFixed(1));

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(99, 102, 241, 0.45)");
    gradient.addColorStop(1, "rgba(99, 102, 241, 0.02)");

    this.monthlySalesChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Monthly Revenue (£ Thousands)",
          data: revenues,
          borderColor: "#6366f1",
          borderWidth: 2.5,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointRadius: 3.5,
          pointHoverRadius: 6.5,
          pointBackgroundColor: "#6366f1",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              title: (items) => `Month: ${items[0].label}`,
              label: (item) => {
                const monthObj = monthlySales[item.dataIndex];
                return [
                  `Revenue: £${monthObj.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  `Orders: ${monthObj.orders.toLocaleString()}`,
                  `Active Buyers: ${monthObj.active_customers.toLocaleString()}`,
                  `Avg Order Value: £${monthObj.avg_order_value.toFixed(2)}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: theme.grid },
            ticks: {
              color: theme.text,
              maxRotation: 45,
              minRotation: 45,
              font: { size: 10 }
            }
          },
          y: {
            title: {
              display: true,
              text: "Revenue (£K)",
              color: theme.text,
              font: { size: 11, weight: "600" }
            },
            grid: { color: theme.grid },
            ticks: {
              color: theme.text,
              callback: val => `£${val}k`
            }
          }
        }
      }
    });

    return this.monthlySalesChart;
  }

  /**
   * Update theme styling across all charts
   */
  updateTheme(isDark) {
    const theme = this.getThemeColors(isDark);
    const charts = [this.scatterChart, this.doughnutChart, this.revenueBarChart, this.monthlySalesChart];

    if (this.doughnutChart?.data?.datasets?.[0]) {
      this.doughnutChart.data.datasets[0].borderColor = isDark ? "#111827" : "#ffffff";
    }

    charts.forEach(chart => {
      if (!chart) return;

      if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = theme.text;
      }

      if (chart.options.plugins?.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
      }

      if (chart.options.scales) {
        Object.keys(chart.options.scales).forEach(scaleKey => {
          const scale = chart.options.scales[scaleKey];
          if (scale.ticks) scale.ticks.color = theme.text;
          if (scale.grid) scale.grid.color = theme.grid;
          if (scale.title) scale.title.color = theme.text;
        });
      }

      chart.update("none");
    });
  }
}

/* ==========================================================================
   Application Controller
   ========================================================================== */

class CustomerSegmentationApp {
  constructor() {
    this.customers = [];
    this.segments = [];
    this.monthlySales = [];
    this.evaluation = null;

    // State
    this.activeSegment = "All";
    this.searchQuery = "";
    this.currentPage = 1;
    this.pageSize = 25;
    this.sortColumn = "monetary";
    this.sortDirection = "desc";
    this.theme = localStorage.getItem("cs_theme") || "dark";

    // Chart manager
    this.charts = new DashboardCharts();
  }

  async init() {
    this.initTheme();
    this.bindDOMEvents();

    try {
      await this.loadData();
      this.hideLoadingOverlay();
      this.renderKPIs();
      this.renderSegmentCards();
      this.initCharts();
      this.renderCustomerTable();
      this.showToast("Dashboard loaded 5,878 customer segments successfully.");
    } catch (err) {
      console.error("Data load error:", err);
      this.handleDataLoadError(err);
    }
  }

  initTheme() {
    document.documentElement.setAttribute("data-theme", this.theme);
    this.updateThemeToggleIcon();
  }

  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", this.theme);
    localStorage.setItem("cs_theme", this.theme);
    this.updateThemeToggleIcon();
    this.charts.updateTheme(this.theme === "dark");
    this.showToast(`Switched to ${this.theme} mode`);
  }

  updateThemeToggleIcon() {
    const icon = document.getElementById("themeIcon");
    if (!icon) return;
    if (this.theme === "dark") {
      icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    } else {
      icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    }
  }

  /**
   * Universal fetch helper that handles both `data/` and `../data/`
   */
  async fetchJsonFile(filename) {
    const candidatePaths = [
      `/data/${filename}`,
      `data/${filename}`,
      `../data/${filename}`
    ];

    for (const p of candidatePaths) {
      try {
        const res = await fetch(p);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        // try next path
      }
    }
    throw new Error(`Unable to fetch ${filename}`);
  }

  async loadData() {
    const [cust, seg, month, evalData] = await Promise.all([
      this.fetchJsonFile("customers.json"),
      this.fetchJsonFile("segments.json"),
      this.fetchJsonFile("monthly_sales.json"),
      this.fetchJsonFile("evaluation.json").catch(() => null)
    ]);

    this.customers = cust;
    this.segments = seg;
    this.monthlySales = month;
    this.evaluation = evalData;
  }

  hideLoadingOverlay() {
    const loader = document.getElementById("loadingOverlay");
    if (loader) loader.classList.add("hidden");
  }

  handleDataLoadError(err) {
    const loader = document.getElementById("loadingOverlay");
    if (loader) {
      loader.innerHTML = `
        <div style="text-align: center; max-width: 480px; padding: 2rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
          <h2 style="margin-bottom: 0.5rem; color: #ef4444;">Unable to Load Data Payloads</h2>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 0.9rem;">
            Failed to retrieve dataset JSON files. Please check that <code>data/*.json</code> files are present in the repository.
          </p>
          <button class="btn-action" onclick="window.location.reload()" style="margin: 0 auto; display: inline-flex;">Retry</button>
        </div>
      `;
    }
  }

  bindDOMEvents() {
    document.getElementById("btnThemeToggle")?.addEventListener("click", () => this.toggleTheme());

    const segmentSelect = document.getElementById("segmentFilterSelect");
    segmentSelect?.addEventListener("change", (e) => this.setSegmentFilter(e.target.value));

    const searchInput = document.getElementById("customerSearchInput");
    const clearBtn = document.getElementById("searchClearBtn");

    searchInput?.addEventListener("input", (e) => this.handleSearchInput(e.target.value.trim()));
    searchInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.lookupExactCustomer(searchInput.value.trim());
    });

    clearBtn?.addEventListener("click", () => {
      searchInput.value = "";
      this.handleSearchInput("");
      searchInput.focus();
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-wrapper")) this.hideSuggestions();
    });

    document.getElementById("btnExportCSV")?.addEventListener("click", () => this.exportFilteredCSV());

    document.getElementById("pageSizeSelect")?.addEventListener("change", (e) => {
      this.pageSize = parseInt(e.target.value, 10);
      this.currentPage = 1;
      this.renderCustomerTable();
    });

    document.getElementById("modalCloseBtn")?.addEventListener("click", () => this.closeCustomerModal());
    document.getElementById("modalBackdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "modalBackdrop") this.closeCustomerModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeCustomerModal();
    });

    document.querySelectorAll(".custom-table th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.getAttribute("data-col");
        this.handleTableSort(col);
      });
    });
  }

  renderKPIs() {
    const totalCustomers = this.customers.length;
    const totalRevenue = this.customers.reduce((acc, c) => acc + c.monetary, 0);
    const avgSpend = totalRevenue / totalCustomers;
    const avgRecency = this.customers.reduce((acc, c) => acc + c.recency, 0) / totalCustomers;

    const champions = this.segments.find(s => s.segment === "Champions");
    const topRevenueShare = champions ? champions.revenue_share : 0;

    const elCust = document.getElementById("kpiTotalCustomers");
    const elRev = document.getElementById("kpiTotalRevenue");
    const elSpend = document.getElementById("kpiAvgSpend");
    const elRec = document.getElementById("kpiAvgRecency");
    const elShare = document.getElementById("kpiTopSegmentShare");

    if (elCust) elCust.textContent = totalCustomers.toLocaleString();
    if (elRev) elRev.textContent = `£${(totalRevenue / 1e6).toFixed(2)}M`;
    if (elSpend) elSpend.textContent = `£${avgSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (elRec) elRec.textContent = `${Math.round(avgRecency)} days`;
    if (elShare) elShare.textContent = `${topRevenueShare}%`;
  }

  renderSegmentCards() {
    const container = document.getElementById("segmentCardsContainer");
    if (!container) return;

    container.innerHTML = "";

    this.segments.forEach(seg => {
      const card = document.createElement("div");
      card.className = `segment-card ${this.activeSegment === seg.segment ? "active" : ""}`;
      card.setAttribute("data-segment", seg.segment);

      card.innerHTML = `
        <div class="segment-card-top">
          <div class="segment-name" style="color: ${seg.color};">
            <span class="segment-dot" style="background-color: ${seg.color};"></span>
            ${seg.segment}
          </div>
          <span class="segment-size-pill">${seg.size.toLocaleString()} users (${seg.size_percentage}%)</span>
        </div>

        <div class="segment-revenue-bar-wrap">
          <div class="segment-rev-flex">
            <span>Revenue Share</span>
            <span style="color: ${seg.color};">${seg.revenue_share}% (£${(seg.total_revenue / 1e6).toFixed(2)}M)</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${seg.revenue_share}%; background-color: ${seg.color};"></div>
          </div>
        </div>

        <div class="segment-metrics-grid">
          <div class="metric-col">
            <div class="metric-col-label">Avg Recency</div>
            <div class="metric-col-val">${seg.avg_recency}d</div>
          </div>
          <div class="metric-col">
            <div class="metric-col-label">Avg Orders</div>
            <div class="metric-col-val">${seg.avg_frequency}</div>
          </div>
          <div class="metric-col">
            <div class="metric-col-label">Avg Spend</div>
            <div class="metric-col-val">£${Math.round(seg.avg_monetary).toLocaleString()}</div>
          </div>
        </div>

        <div class="recommendation-box" style="border-left-color: ${seg.color};">
          <div class="recommendation-label" style="color: ${seg.color};">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
            Recommended Action
          </div>
          ${seg.recommendation}
        </div>
      `;

      card.addEventListener("click", () => {
        if (this.activeSegment === seg.segment) {
          this.setSegmentFilter("All");
        } else {
          this.setSegmentFilter(seg.segment);
        }
      });

      container.appendChild(card);
    });
  }

  initCharts() {
    this.charts.initScatterPlot("scatterChartCanvas", this.customers, (customer) => {
      this.openCustomerModal(customer);
    });

    this.charts.initDoughnutChart("doughnutChartCanvas", this.segments, (clickedSegment) => {
      this.setSegmentFilter(clickedSegment);
    });

    this.charts.initRevenueBarChart("revenueBarChartCanvas", this.segments, (clickedSegment) => {
      this.setSegmentFilter(clickedSegment);
    });

    this.charts.initMonthlySalesChart("monthlySalesChartCanvas", this.monthlySales);
  }

  setSegmentFilter(segmentName) {
    this.activeSegment = segmentName;

    const select = document.getElementById("segmentFilterSelect");
    if (select && select.value !== segmentName) {
      select.value = segmentName;
    }

    document.querySelectorAll(".segment-card").forEach(card => {
      if (card.getAttribute("data-segment") === segmentName) {
        card.classList.add("active");
      } else {
        card.classList.remove("active");
      }
    });

    this.charts.filterScatter(segmentName);

    this.currentPage = 1;
    this.renderCustomerTable();

    this.showToast(segmentName === "All" ? "Showing all customer segments" : `Filtered by ${segmentName}`);
  }

  handleSearchInput(query) {
    this.searchQuery = query;
    const clearBtn = document.getElementById("searchClearBtn");
    if (clearBtn) clearBtn.style.display = query ? "block" : "none";

    const suggestionsEl = document.getElementById("searchSuggestions");
    if (!suggestionsEl) return;

    if (!query) {
      this.hideSuggestions();
      this.currentPage = 1;
      this.renderCustomerTable();
      return;
    }

    const matches = this.customers.filter(c => c.customer_id.includes(query)).slice(0, 8);

    if (matches.length > 0) {
      suggestionsEl.innerHTML = matches.map(c => {
        const segObj = this.segments.find(s => s.segment === c.segment) || { color: "#3b82f6" };
        return `
          <div class="suggestion-item" data-id="${c.customer_id}">
            <div>
              <strong>#${c.customer_id}</strong>
              <span class="badge-segment" style="margin-left: 0.5rem; background: ${segObj.color}20; color: ${segObj.color}; border: 1px solid ${segObj.color}40;">
                ${c.segment}
              </span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              £${c.monetary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        `;
      }).join("");

      suggestionsEl.style.display = "block";

      suggestionsEl.querySelectorAll(".suggestion-item").forEach(item => {
        item.addEventListener("click", () => {
          const cid = item.getAttribute("data-id");
          const cust = this.customers.find(c => c.customer_id === cid);
          if (cust) {
            this.openCustomerModal(cust);
            this.hideSuggestions();
          }
        });
      });
    } else {
      suggestionsEl.innerHTML = `<div style="padding: 0.75rem; color: var(--text-muted); font-size: 0.85rem; text-align: center;">No customer matching "${query}"</div>`;
      suggestionsEl.style.display = "block";
    }

    this.currentPage = 1;
    this.renderCustomerTable();
  }

  hideSuggestions() {
    const suggestionsEl = document.getElementById("searchSuggestions");
    if (suggestionsEl) suggestionsEl.style.display = "none";
  }

  lookupExactCustomer(query) {
    if (!query) return;
    const cust = this.customers.find(c => c.customer_id === query);
    if (cust) {
      this.openCustomerModal(cust);
      this.hideSuggestions();
    } else {
      this.showToast(`Customer #${query} not found`);
    }
  }

  getProcessedCustomers() {
    let list = this.customers;

    if (this.activeSegment !== "All") {
      list = list.filter(c => c.segment === this.activeSegment);
    }

    if (this.searchQuery) {
      list = list.filter(c => c.customer_id.includes(this.searchQuery));
    }

    list = [...list].sort((a, b) => {
      let valA = a[this.sortColumn];
      let valB = b[this.sortColumn];

      if (this.sortColumn === "customer_id") {
        valA = parseInt(valA, 10);
        valB = parseInt(valB, 10);
      }

      if (typeof valA === "string") {
        return this.sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return this.sortDirection === "asc" ? valA - valB : valB - valA;
    });

    return list;
  }

  handleTableSort(column) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortColumn = column;
      this.sortDirection = "desc";
    }

    document.querySelectorAll(".custom-table th.sortable").forEach(th => {
      th.classList.remove("sorted-asc", "sorted-desc");
      const indicator = th.querySelector(".sort-indicator");
      if (indicator) indicator.textContent = "↕";

      if (th.getAttribute("data-col") === column) {
        th.classList.add(this.sortDirection === "asc" ? "sorted-asc" : "sorted-desc");
        if (indicator) indicator.textContent = this.sortDirection === "asc" ? "↑" : "↓";
      }
    });

    this.renderCustomerTable();
  }

  renderCustomerTable() {
    const list = this.getProcessedCustomers();
    const total = list.length;
    const totalPages = Math.ceil(total / this.pageSize) || 1;

    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, total);
    const pageItems = list.slice(startIndex, endIndex);

    const infoEl = document.getElementById("tableInfoText");
    if (infoEl) {
      infoEl.textContent = total > 0
        ? `Showing ${startIndex + 1}–${endIndex} of ${total.toLocaleString()} customers`
        : "No customers match the criteria";
    }

    const tbody = document.getElementById("customerTableBody");
    if (!tbody) return;

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No customer records found.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = pageItems.map(c => {
        const segBadgeClass = `badge-segment-${c.segment.toLowerCase().replace(/\s+/g, "-")}`;
        return `
          <tr data-id="${c.customer_id}">
            <td style="font-weight: 600; font-family: monospace;">#${c.customer_id}</td>
            <td><span class="badge-segment ${segBadgeClass}">${c.segment}</span></td>
            <td>${c.recency} days ago</td>
            <td>${c.frequency} orders</td>
            <td style="font-weight: 600;">£${c.monetary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="color: var(--text-muted); font-size: 0.8rem; font-family: monospace;">(${c.pca_x}, ${c.pca_y})</td>
            <td>
              <button class="btn-view-customer" onclick="window.__appInstance.openCustomerModalById('${c.customer_id}')">
                Profile
              </button>
            </td>
          </tr>
        `;
      }).join("");
    }

    this.renderPagination(totalPages);
  }

  renderPagination(totalPages) {
    const container = document.getElementById("paginationControls");
    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    let html = `
      <button class="btn-page" ${this.currentPage === 1 ? "disabled" : ""} onclick="window.__appInstance.goToPage(1)" title="First Page">«</button>
      <button class="btn-page" ${this.currentPage === 1 ? "disabled" : ""} onclick="window.__appInstance.goToPage(${this.currentPage - 1})" title="Previous Page">‹</button>
    `;

    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, this.currentPage + 2);

    if (startPage > 1) {
      html += `<button class="btn-page" onclick="window.__appInstance.goToPage(1)">1</button>`;
      if (startPage > 2) html += `<span style="padding: 0 0.25rem; color: var(--text-muted);">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
      html += `<button class="btn-page ${p === this.currentPage ? "active" : ""}" onclick="window.__appInstance.goToPage(${p})">${p}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span style="padding: 0 0.25rem; color: var(--text-muted);">...</span>`;
      html += `<button class="btn-page" onclick="window.__appInstance.goToPage(${totalPages})">${totalPages}</button>`;
    }

    html += `
      <button class="btn-page" ${this.currentPage === totalPages ? "disabled" : ""} onclick="window.__appInstance.goToPage(${this.currentPage + 1})" title="Next Page">›</button>
      <button class="btn-page" ${this.currentPage === totalPages ? "disabled" : ""} onclick="window.__appInstance.goToPage(${totalPages})" title="Last Page">»</button>
    `;

    container.innerHTML = html;
  }

  goToPage(page) {
    this.currentPage = page;
    this.renderCustomerTable();
  }

  openCustomerModalById(customerId) {
    const cust = this.customers.find(c => c.customer_id === customerId);
    if (cust) this.openCustomerModal(cust);
  }

  openCustomerModal(customer) {
    const modal = document.getElementById("modalBackdrop");
    const seg = this.segments.find(s => s.segment === customer.segment);
    if (!modal || !seg) return;

    document.getElementById("modalCustomerId").textContent = `#${customer.customer_id}`;
    
    const badge = document.getElementById("modalCustomerBadge");
    badge.textContent = customer.segment;
    badge.className = `badge-segment badge-segment-${customer.segment.toLowerCase().replace(/\s+/g, "-")}`;

    document.getElementById("modalRecencyVal").textContent = `${customer.recency}d`;
    document.getElementById("modalFrequencyVal").textContent = `${customer.frequency}`;
    document.getElementById("modalMonetaryVal").textContent = `£${customer.monetary.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    const rDiff = customer.recency - seg.avg_recency;
    const fDiff = customer.frequency - seg.avg_frequency;
    const mDiff = ((customer.monetary - seg.avg_monetary) / seg.avg_monetary) * 100;

    const rDiffEl = document.getElementById("modalRecencyDiff");
    rDiffEl.textContent = `${rDiff >= 0 ? "+" : ""}${Math.round(rDiff)}d vs seg avg`;
    rDiffEl.className = `modal-metric-diff ${rDiff <= 0 ? "positive" : "negative"}`;

    const fDiffEl = document.getElementById("modalFrequencyDiff");
    fDiffEl.textContent = `${fDiff >= 0 ? "+" : ""}${fDiff.toFixed(1)} orders vs avg`;
    fDiffEl.className = `modal-metric-diff ${fDiff >= 0 ? "positive" : "negative"}`;

    const mDiffEl = document.getElementById("modalMonetaryDiff");
    mDiffEl.textContent = `${mDiff >= 0 ? "+" : ""}${Math.round(mDiff)}% vs seg avg`;
    mDiffEl.className = `modal-metric-diff ${mDiff >= 0 ? "positive" : "negative"}`;

    document.getElementById("modalRecommendationText").textContent = seg.recommendation;
    document.getElementById("modalPcaCoords").textContent = `PC1: ${customer.pca_x}, PC2: ${customer.pca_y}`;

    modal.classList.add("show");
  }

  closeCustomerModal() {
    const modal = document.getElementById("modalBackdrop");
    if (modal) modal.classList.remove("show");
  }

  exportFilteredCSV() {
    const list = this.getProcessedCustomers();
    if (list.length === 0) {
      this.showToast("No records to export");
      return;
    }

    const headers = ["Customer_ID", "Segment", "Recency_Days", "Frequency_Orders", "Monetary_Spend_GBP", "PCA_X", "PCA_Y"];
    const rows = list.map(c => [
      `"${c.customer_id}"`,
      `"${c.segment}"`,
      c.recency,
      c.frequency,
      c.monetary.toFixed(2),
      c.pca_x,
      c.pca_y
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `customer_segmentation_${this.activeSegment.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast(`Exported ${list.length.toLocaleString()} records to CSV`);
  }

  showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

// Global initialization
window.__appInstance = null;
document.addEventListener("DOMContentLoaded", () => {
  window.__appInstance = new CustomerSegmentationApp();
  window.__appInstance.init();
});
