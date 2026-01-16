# How to Deploy

1. Create `.env.[environment]`
2. `export ENIVRONMENT=[production,development]`
3. Run DB migrations using `npm run migrate:[prod,dev]`
4. Migrate settings and migrate channel IDs: `npm run migrate-settings`, `npm run migrate-channel-ids`
5. Create proxy config data file like this

```json
[
  {
    "box": "tradent",
    "proxy_username": "tradent",
    "proxy_password": "PASSWORD",
    "subscription_key": "SUBSCRIPTION_KEY_NET32",
    "ip": "174.138.69.66",
    "port": 8888,
    "vendor_id": 17357
  },
  {
    "box": "mvp",
    "proxy_username": "mvp",
    "proxy_password": "PASSWORD",
    "subscription_key": "SUBSCRIPTION_KEY_NET32",
    "ip": "159.203.121.58",
    "port": 8888,
    "vendor_id": 20755
  },
  {
    "box": "firstdent",
    "proxy_username": "firstdent",
    "proxy_password": "PASSWORD",
    "subscription_key": "SUBSCRIPTION_KEY_NET32",
    "ip": "159.203.73.122",
    "port": 8888,
    "vendor_id": 20533
  },
  {
    "box": "topdent",
    "proxy_username": "topdent",
    "proxy_password": "PASSOWRD",
    "subscription_key": "SUBSCRIPTION_KEY_NET32",
    "ip": "142.93.187.112",
    "port": 8888,
    "vendor_id": 20727
  },
  {
    "box": "triad",
    "proxy_username": "triad",
    "proxy_password": "PASSWORD",
    "subscription_key": "SUBSCRIPTION_KEY_NET32",
    "ip": "165.227.99.82",
    "port": 8888,
    "vendor_id": 20726
  },
  {
    "box": "frontier",
    "proxy_username": "frontier",
    "proxy_password": "PASSWORD",
    "subscription_key": "SUBSCRIPTION_KEY_NET32",
    "ip": "138.197.27.59",
    "port": 8888,
    "vendor_id": 20722
  },
  {
    "box": "bitesupply",
    "proxy_username": "bitesupply",
    "proxy_password": "PASSWORD",
    "subscription_key": "SUBSCRIPTION_KEY_NET32",
    "ip": "159.89.43.166",
    "port": 8888,
    "vendor_id": 99995
  }
]
```

6. Run `npm run seed:[dev,production]` to upload proxy configs
7. Create users using `npm run create-user`
