import axios from "axios";

export async function getAsync(_url: string) {
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: _url,
    headers: {},
  };
  axios
    .request(config)
    .then((response) => {
      console.log(`STORAGE-SENSE : ${response.data}`);
    })
    .catch((error) => {
      console.log(`STORAGE-SENSE : ${error}`);
    });
}

export async function getData(_url: string) {
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: _url,
    headers: {},
  };
  return axios.request(config);
}

export async function postData(_url: string, _payload: any) {
  const config = {
    method: "post",
    url: _url,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    data: JSON.stringify(_payload),
  };
  return axios(config);
}

export async function postDataForExcel(_url: string, _payload: any) {
  const config: any = {
    method: "post",
    url: _url,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    },
    responseType: "arraybuffer",
    data: JSON.stringify(_payload),
  };
  return axios(config);
}
