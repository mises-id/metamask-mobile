import Engine from '../../core/Engine';

const initialState = {
  backgroundState: {},
};

const engineReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'INIT_BG_STATE':
      return { backgroundState: Engine.state };
    case 'UPDATE_BG_STATE': {
      // if (action.key === 'MisesController')
      //   console.log(JSON.stringify(Engine.state[action.key]), '============================');
      const newState = { ...state };
      newState.backgroundState[action.key] = Engine.state[action.key];
      return newState;
    }
    default:
      return state;
  }
};

export default engineReducer;
