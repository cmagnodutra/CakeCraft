import { apiRequest } from './client';
import {
  calculateCakePrice,
  cancelOrder,
  createOrder,
  fetchMyOrders,
  fetchOrderById,
  regenerateOrderPix,
  resolveApiAssetUrl,
  uploadRicePaperImage,
} from './orders';

jest.mock('./client');

const apiRequestMock = jest.mocked(apiRequest);

const sampleFloor = {
  floorNumber: 1,
  doughIngredientId: 'massa-1',
  coverageIngredientId: 'cob-1',
  fillingIngredientIds: ['rech-1'],
  estimatedWeightKg: 1.5,
};

beforeEach(() => apiRequestMock.mockReset());

describe('cliente de API de precificacao, uploads e pedidos (UC01 / RF02-RF07)', () => {
  it('calculateCakePrice faz POST em /pricing/calculate com os andares', async () => {
    const quote = {
      layers: [{ floorNumber: 1, weightKg: 1.5, pricePerKgCombined: 120, subtotal: 180 }],
      assemblyBaseFee: 25,
      totalPrice: 205,
    };
    apiRequestMock.mockResolvedValue(quote);

    await expect(calculateCakePrice([sampleFloor])).resolves.toEqual(quote);
    expect(apiRequestMock).toHaveBeenCalledWith('/pricing/calculate', {
      method: 'POST',
      body: { floors: [sampleFloor] },
    });
  });

  it('uploadRicePaperImage faz POST em /uploads/rice-paper enviando FormData', async () => {
    const uploaded = {
      url: '/api/uploads/rice-paper/11111111-1111-4111-8111-111111111111.png',
      mimeType: 'image/png' as const,
      sizeBytes: 128,
    };
    apiRequestMock.mockResolvedValue(uploaded);
    const file = new File(['conteudo'], 'arte.png', { type: 'image/png' });

    await expect(uploadRicePaperImage(file)).resolves.toEqual(uploaded);
    const [path, options] = apiRequestMock.mock.calls[0];
    expect(path).toBe('/uploads/rice-paper');
    expect(options?.method).toBe('POST');
    expect(options?.body).toBeInstanceOf(FormData);
    expect((options?.body as FormData).get('file')).toBe(file);
  });

  it('createOrder, fetchMyOrders, fetchOrderById, cancelOrder e regenerateOrderPix chamam as rotas REST corretas', async () => {
    const sampleOrder = { id: 'ord-1', status: 'AGUARDANDO_PAGAMENTO', totalPrice: 205 };
    apiRequestMock.mockResolvedValue(sampleOrder);

    await createOrder({
      format: 'REDONDO',
      colorHex: '#FAF7F2',
      floors: [sampleFloor],
      dietaryFlags: ['lactose'],
      toppingMessage: 'Parabéns!',
    });
    expect(apiRequestMock).toHaveBeenCalledWith('/orders', {
      method: 'POST',
      body: {
        format: 'REDONDO',
        colorHex: '#FAF7F2',
        floors: [sampleFloor],
        dietaryFlags: ['lactose'],
        toppingMessage: 'Parabéns!',
      },
    });

    apiRequestMock.mockResolvedValueOnce([sampleOrder]);
    await expect(fetchMyOrders()).resolves.toEqual([sampleOrder]);
    expect(apiRequestMock).toHaveBeenCalledWith('/orders/my');

    await fetchOrderById('ord-1');
    expect(apiRequestMock).toHaveBeenCalledWith('/orders/ord-1');

    await cancelOrder('ord-1');
    expect(apiRequestMock).toHaveBeenCalledWith('/orders/ord-1/cancel', { method: 'POST' });

    await regenerateOrderPix('ord-1');
    expect(apiRequestMock).toHaveBeenCalledWith('/orders/ord-1/regenerate-pix', {
      method: 'POST',
    });
  });

  it('resolveApiAssetUrl anexa a origem da API em caminhos relativos e preserva data/https', () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.test/api';
    expect(resolveApiAssetUrl('/api/uploads/rice-paper/1.png')).toBe(
      'http://api.test/api/uploads/rice-paper/1.png',
    );
    expect(resolveApiAssetUrl('api/uploads/rice-paper/2.png')).toBe(
      'http://api.test/api/uploads/rice-paper/2.png',
    );
    expect(resolveApiAssetUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(resolveApiAssetUrl('https://cdn.test/img.png')).toBe('https://cdn.test/img.png');
    delete process.env.NEXT_PUBLIC_API_URL;
  });
});
