import { io } from 'socket.io-client';

import { subscribeToOrderUpdates } from './orders-socket';

jest.mock('socket.io-client');

const ioMock = jest.mocked(io);

describe('subscribeToOrderUpdates (Socket.io /ws/orders)', () => {
  const onMock = jest.fn();
  const offMock = jest.fn();
  const disconnectMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api';
    ioMock.mockReturnValue({
      on: onMock,
      off: offMock,
      disconnect: disconnectMock,
    } as unknown as ReturnType<typeof io>);
  });

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it('conecta ao namespace /ws/orders com withCredentials: true e limpa ao desinscrever', () => {
    const handler = jest.fn();
    const unsubscribe = subscribeToOrderUpdates(handler);

    expect(ioMock).toHaveBeenCalledWith('http://api.test/ws/orders', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    expect(onMock).toHaveBeenCalledWith('order.updated', handler);

    unsubscribe();
    expect(offMock).toHaveBeenCalledWith('order.updated', handler);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
