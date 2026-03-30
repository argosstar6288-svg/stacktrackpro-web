const axios = require("axios");
const { getAccessToken, BASE } = require("./ebayAuth");

const EBAY_ENV = String(process.env.EBAY_ENV || "SANDBOX").toUpperCase();
const FINDING_BASE =
  EBAY_ENV === "PRODUCTION"
    ? "https://svcs.ebay.com"
    : "https://svcs.sandbox.ebay.com";

async function getSoldListingsFromFindingApi(query) {
  const appId = process.env.EBAY_CLIENT_ID;
  if (!appId) {
    throw new Error("Missing EBAY_CLIENT_ID in stacktrack-backend/.env");
  }

  const res = await axios.get(`${FINDING_BASE}/services/search/FindingService/v1`, {
    params: {
      "OPERATION-NAME": "findCompletedItems",
      "SERVICE-VERSION": "1.13.0",
      "SECURITY-APPNAME": appId,
      "RESPONSE-DATA-FORMAT": "JSON",
      "REST-PAYLOAD": true,
      keywords: query,
      "itemFilter(0).name": "SoldItemsOnly",
      "itemFilter(0).value": "true",
      "paginationInput.entriesPerPage": 25,
      sortOrder: "EndTimeSoonest",
    },
  });

  const items =
    res?.data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];

  return items
    .map((item) => ({
      price: parseFloat(item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0),
      title: item?.title?.[0] || "",
      date: item?.listingInfo?.[0]?.endTime?.[0] || new Date().toISOString(),
      image: item?.galleryURL?.[0],
      source: "sold",
    }))
    .filter((item) => Number.isFinite(item.price) && item.price > 0);
}

async function getBrowseListingsFallback(query) {
  const token = await getAccessToken();

  const res = await axios.get(`${BASE}/buy/browse/v1/item_summary/search`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      q: query,
      filter: "buyingOptions:{FIXED_PRICE,AUCTION},conditions:{USED,NEW}",
      sort: "price",
      limit: 25,
    },
  });

  const items = res?.data?.itemSummaries || [];

  return items
    .map((item) => ({
      price: parseFloat(item?.price?.value || 0),
      title: item?.title || "",
      date: new Date().toISOString(),
      image: item?.image?.imageUrl,
      source: "browse-fallback",
    }))
    .filter((item) => Number.isFinite(item.price) && item.price > 0);
}

async function searchSoldItems(query) {
  return getSoldListingsFromFindingApi(query);
}

function calculateCardValue(items) {
  const prices = (Array.isArray(items) ? items : [])
    .map((item) => Number(item?.price))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  if (!prices.length) {
    return null;
  }

  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 !== 0
    ? prices[mid]
    : (prices[mid - 1] + prices[mid]) / 2;
}

const getEbaySales = async (query) => {
  const sold = await searchSoldItems(query);
  if (sold.length > 0) {
    return sold;
  }

  // Fallback for sparse sandbox sold data.
  return getBrowseListingsFallback(query);
};

module.exports = { getEbaySales, searchSoldItems, calculateCardValue };
