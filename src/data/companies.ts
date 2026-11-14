import type { Company } from "@/types";
export const portfolio: Company[] = [
  ["RELIANCE", "Reliance Industries", "Energy"],
  ["HDFCBANK", "HDFC Bank", "Financials"],
  ["ICICIBANK", "ICICI Bank", "Financials"],
  ["INFY", "Infosys", "Technology"],
  ["TCS", "Tata Consultancy Services", "Technology"],
  ["HCLTECH", "HCL Technologies", "Technology"],
  ["ITC", "ITC", "Consumer staples"],
  ["HINDUNILVR", "Hindustan Unilever", "Consumer staples"],
  ["BHARTIARTL", "Bharti Airtel", "Telecom"],
  ["SUNPHARMA", "Sun Pharmaceutical", "Healthcare"],
  ["DRREDDY", "Dr. Reddy’s Laboratories", "Healthcare"],
  ["LT", "Larsen & Toubro", "Industrials"],
  ["NTPC", "NTPC", "Utilities"],
  ["MARUTI", "Maruti Suzuki", "Automobiles"],
  ["TITAN", "Titan Company", "Consumer discretionary"],
  ["CDSL", "Central Depository Services", "Financial infrastructure"],
  ["DIXON", "Dixon Technologies", "Electronics"],
  ["TRENT", "Trent", "Retail"],
].map(([ticker, name, sector]) => ({ ticker, name, sector }));
export const candidates: Company[] = [
  ["ASIANPAINT", "Asian Paints", "Materials"],
  ["PIDILITIND", "Pidilite Industries", "Materials"],
  ["DMART", "Avenue Supermarts", "Retail"],
  ["BAJFINANCE", "Bajaj Finance", "Financials"],
].map(([ticker, name, sector]) => ({ ticker, name, sector }));
