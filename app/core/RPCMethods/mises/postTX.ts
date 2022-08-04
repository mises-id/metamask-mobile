import { ethErrors } from 'eth-json-rpc-errors';

const postTX = async ({ req, res, requestUserApproval }: any) => {
  const { params, origin } = req;
  try {
    // const result = await postTx(params[0]);
    const data = await requestUserApproval({
      origin,
      type: 'mises_stakingPostTx',
      requestData: params[0],
    });
    if (data.code) {
      res.error = {
        code: data.code,
        message: data.data.originalError,
      };
      throw ethErrors.rpc.invalidParams({
        message: data.data.originalError,
      });
    } else {
      res.result = data;
    }
  } catch (error) {
    throw ethErrors.rpc.invalidParams({
      message: 'User rejected the request.',
    });
  }
};

export default postTX;
