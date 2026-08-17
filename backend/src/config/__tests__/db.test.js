const mongoose = require('mongoose');
const connectDB = require('../db');

jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn(),
    connection: {
      on: jest.fn(),
    },
  };
});

describe('connectDB connection retry logic', () => {
  let originalExit;
  let exitMock;

  beforeEach(() => {
    jest.clearAllMocks();
    originalExit = process.exit;
    exitMock = jest.fn();
    process.exit = exitMock;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit = originalExit;
    console.log.mockRestore();
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  test('should connect successfully on first attempt', async () => {
    mongoose.connect.mockResolvedValueOnce({});

    await connectDB(3, 10);

    expect(mongoose.connect).toHaveBeenCalledTimes(1);
    expect(exitMock).not.toHaveBeenCalled();
  });

  test('should retry and successfully connect on a subsequent attempt', async () => {
    mongoose.connect
      .mockRejectedValueOnce(new Error('Connection timeout'))
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce({});

    await connectDB(4, 5); // 5ms delay

    expect(mongoose.connect).toHaveBeenCalledTimes(3);
    expect(exitMock).not.toHaveBeenCalled();
  });

  test('should exhaust all retries and exit the process on persistent failures', async () => {
    mongoose.connect.mockRejectedValue(new Error('Network error'));

    await connectDB(3, 5); // 3 retries, 5ms initial delay

    expect(mongoose.connect).toHaveBeenCalledTimes(3);
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});
