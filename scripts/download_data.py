#!/usr/bin/env python3
"""
Utility script to download and extract the UCI Online Retail II dataset.
Usage: python scripts/download_data.py
"""

import os
import sys
import zipfile
import urllib.request

DATA_DIR = "data"
DATASET_URL = "https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip"
ZIP_PATH = os.path.join(DATA_DIR, "online_retail_ii.zip")
XLSX_PATH = os.path.join(DATA_DIR, "online_retail_II.xlsx")


def download_dataset():
    os.makedirs(DATA_DIR, exist_ok=True)

    if os.path.exists(XLSX_PATH):
        print(f"Dataset already exists at {XLSX_PATH} ({os.path.getsize(XLSX_PATH) / (1024*1024):.1f} MB)")
        return

    print(f"Downloading UCI Online Retail II dataset from:\n  {DATASET_URL}")
    opener = urllib.request.build_opener()
    opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
    urllib.request.install_opener(opener)

    def report_progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = downloaded / total_size * 100
            sys.stdout.write(f"\rDownloading: {downloaded / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB ({percent:.1f}%)")
        else:
            sys.stdout.write(f"\rDownloading: {downloaded / (1024*1024):.1f} MB")
        sys.stdout.flush()

    urllib.request.urlretrieve(DATASET_URL, ZIP_PATH, reporthook=report_progress)
    print("\nDownload complete. Extracting archive...")

    with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
        zip_ref.extractall(DATA_DIR)

    print(f"Successfully extracted dataset to {DATA_DIR}/")


if __name__ == "__main__":
    download_dataset()
