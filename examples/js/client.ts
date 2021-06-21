import * as caller from "@eeston/grpc-caller";
import Decimal from "decimal.js";

const file = "../../proto/exchange/matchengine.proto";
const load = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
};

class Client {
  client: any;
  markets: Map<string, any>;
  constructor(server = process.env.GRPC_SERVER || "localhost:50051") {
    console.log("using grpc", server);
    this.client = caller(`${server}`, { file, load }, "Matchengine");
  }

  async connect() {
    this.markets = await this.marketList();
  }

  async balanceQuery(user_id): Promise<Map<string, any>> {
    const balances = (await this.client.BalanceQuery({ user_id: user_id }))
      .balances;
    let result = new Map();
    for (const entry of balances) {
      result.set(entry.asset_id, entry);
    }
    return result;
  }
  async balanceQueryByAsset(user_id, asset) {
    const allBalances = (
      await this.client.BalanceQuery({ user_id: user_id, assets: [asset] })
    ).balances;
    const balance = allBalances.find(item => item.asset_id == asset);
    let available = new Decimal(balance.available);
    let frozen = new Decimal(balance.frozen);
    let total = available.add(frozen);
    return { available, frozen, total };
  }

  async balanceUpdate(user_id, asset, business, business_id, delta, detail) {
    return await this.client.BalanceUpdate({
      user_id,
      asset,
      business,
      business_id,
      delta,
      detail: JSON.stringify(detail)
    });
  }
  async createOrder(
    user_id,
    market,
    order_side,
    order_type,
    amount,
    price,
    taker_fee,
    maker_fee
  ) {
    if (!this.markets) {
      await this.connect();
    }
    if (!this.markets.has(market)) {
      throw new Error("invalid market " + market);
    }
    // TODO: round down?
    let amount_rounded = amount.toFixed(this.markets[market].amount_precision);
    let price_rounded = price.toFixed(this.markets[market].price_precision);
    return {
      user_id,
      market,
      order_side,
      order_type,
      amount: amount_rounded,
      price: price_rounded,
      taker_fee,
      maker_fee
    };
  }
  async orderPut(
    user_id,
    market,
    order_side,
    order_type,
    amount,
    price,
    taker_fee,
    maker_fee
  ) {
    const order = await this.createOrder(
      user_id,
      market,
      order_side,
      order_type,
      amount,
      price,
      taker_fee,
      maker_fee
    );
    return await this.client.OrderPut(order);
  }

  async assetList() {
    return (await this.client.AssetList({})).asset_lists;
  }

  async marketList(): Promise<Map<string, any>> {
    const markets = (await this.client.MarketList({})).markets;
    let map = new Map();
    for (const m of markets) {
      map.set(m.name, m);
    }
    return map;
  }

  async orderDetail(market, order_id) {
    return await this.client.OrderDetail({ market, order_id });
  }

  async marketSummary(req) {
    let markets;
    if (req == null) {
      markets = [];
    } else if (typeof req === "string") {
      markets = [req];
    } else if (Array.isArray(req)) {
      markets = req;
    }
    let resp = (await this.client.MarketSummary({ markets })).market_summaries;
    if (typeof req === "string") {
      return resp.find(item => item.name === req);
    }
    return resp;
  }

  async reloadMarkets(from_scratch: boolean = false) {
    return await this.client.ReloadMarkets({ from_scratch });
  }

  async orderCancel(user_id, market, order_id) {
    return await this.client.OrderCancel({ user_id, market, order_id });
  }

  async orderCancelAll(user_id, market) {
    return await this.client.OrderCancelAll({ user_id, market });
  }

  async orderDepth(market, limit, interval) {
    return await this.client.OrderBookDepth({ market, limit, interval });
  }

  async transfer(from, to, asset, delta, memo = "") {
    return await this.client.transfer({
      from,
      to,
      asset,
      delta,
      memo
    });
  }

  async debugDump() {
    return await this.client.DebugDump({});
  }

  async debugReset() {
    return await this.client.DebugReset({});
  }

  async debugReload() {
    return await this.client.DebugReload({});
  }

  async registerUser(user) {
    return await this.client.RegisterUser({
      user_id: user.id,
      l1_address: user.l1_address,
      l2_pubkey: user.l2_pubkey
    });
  }
}

let defaultClient = new Client();
export { defaultClient, Client };
