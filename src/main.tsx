import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserMultiFormatOneDReader } from '@zxing/browser';
import './style.css';
import {parseCsv} from './csv';

type City = 'astana' | 'almaty';
type Store = {
  id: number;
  name: string;
  city: string;
  address: string | null;
  product_count?: number;
};
type DirectoryStore = {
  id: number;
  kind: 'merchant' | 'retailer';
  retailer_id: string | null;
  external_store_id: string | null;
  name: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};
type RetailerStatus = {
  id: string;
  name: string;
  integrationStatus: string;
  verdict: 'GREEN' | 'YELLOW' | 'RED';
  eanSupport: string;
  priceSupport: string;
  notes: string;
};

function localDateTimeValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function App() {
  const [mode, setMode] = useState<'customer' | 'merchant'>('customer');
  const [city, setCity] = useState<City>('astana');
  const [ean, setEan] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');
  const [result, setResult] = useState<any>();
  const [loading, setLoading] = useState(false);

  const [storeFilter,setStoreFilter]=useState('');
  const matchesStore=(store:{name:string;address:string|null;city:string})=>[store.name,store.address,store.city].join(' ').toLowerCase().includes(storeFilter.toLowerCase());
  const [stores, setStores] = useState<Store[]>([]);
  const [directoryStores, setDirectoryStores] = useState<DirectoryStore[]>([]);
  const [retailers, setRetailers] = useState<RetailerStatus[]>([]);

  const [merchantStoreId, setMerchantStoreId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeCity, setStoreCity] = useState('Астана');
  const [storeAddress, setStoreAddress] = useState('');
  const [merchantEan, setMerchantEan] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [merchantPrice, setMerchantPrice] = useState('');
  const [merchantOldPrice, setMerchantOldPrice] = useState('');
  const [merchantMessage, setMerchantMessage] = useState('');
  const [catalog, setCatalog] = useState<any[]>([]);
  const [merchantBusy, setMerchantBusy] = useState(false);

  const [observe, setObserve] = useState(false);
  const [observationStoreId, setObservationStoreId] = useState('');
  const [observationEan, setObservationEan] = useState('');
  const [observationPrice, setObservationPrice] = useState('');
  const [observationOldPrice, setObservationOldPrice] = useState('');
  const [observationTime, setObservationTime] = useState(localDateTimeValue());
  const [observationComment, setObservationComment] = useState('');
  const [observationPhoto, setObservationPhoto] = useState<File | null>(null);
  const [observationMessage, setObservationMessage] = useState('');
  const [observationBusy, setObservationBusy] = useState(false);
  const [observations, setObservations] = useState<any[]>([]);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('Наведите камеру на штрихкод товара');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<any>(null);
  const scanSessionRef = useRef(0);
  const scanLockedRef = useRef(false);
  const scanTargetRef = useRef<'customer' | 'merchant'>('customer');

  const refreshStores = async () => {
    try {
      const response = await fetch('/api/v1/stores');
      const data = await response.json();
      setStores(Array.isArray(data) ? data : []);
      if (!merchantStoreId && data.length) setMerchantStoreId(String(data[0].id));
    } catch {}
  };

  const refreshStoreDirectory = async () => {
    try {
      const response = await fetch('/api/v1/store-directory');
      const data = await response.json();
      setDirectoryStores(Array.isArray(data?.stores) ? data.stores : []);
    } catch {
      setDirectoryStores([]);
    }
  };

  const refreshRetailers = async () => {
    try {
      const response = await fetch('/api/v1/retailers');
      const data = await response.json();
      setRetailers(Array.isArray(data) ? data : []);
    } catch {}
  };

  const refreshCatalog = async (storeId = merchantStoreId) => {
    if (!storeId) {
      setCatalog([]);
      return;
    }
    try {
      const response = await fetch(`/api/v1/stores/${storeId}/catalog`);
      const data = await response.json();
      setCatalog(Array.isArray(data) ? data : []);
    } catch {
      setCatalog([]);
    }
  };

  const refreshObservations = async (code = ean) => {
    if (!code) {
      setObservations([]);
      return;
    }
    try {
      const response = await fetch(`/api/v1/observations?ean=${encodeURIComponent(code)}`);
      const data = await response.json();
      setObservations(Array.isArray(data) ? data : []);
    } catch {
      setObservations([]);
    }
  };

  const search = async (code = ean, refresh = false) => {
    const cleanCode = code.replace(/\D/g, '');
    if (!cleanCode) return;

    setEan(cleanCode);
    setLoading(true);
    try {
      const url =
        selectedSource === 'all'
          ? `/api/v1/compare?ean=${encodeURIComponent(cleanCode)}&city=${city}${refresh ? '&refresh=1' : ''}`
          : `/api/v1/stores/${selectedSource}/price?ean=${encodeURIComponent(cleanCode)}`;

      const response = await fetch(url);
      const data = await response.json();
      setResult(data);
      await refreshObservations(cleanCode);
    } catch {
      setResult({
        status: 'source_error',
        message: 'Не удалось связаться с сервером.',
      });
    } finally {
      setLoading(false);
    }
  };

  const stopScanner = () => {
    scanSessionRef.current += 1;
    try {
      controlsRef.current?.stop?.();
    } catch {}
    controlsRef.current = null;
    BrowserMultiFormatOneDReader.releaseAllStreams();
    scanLockedRef.current = false;
    setScannerOpen(false);
  };

  const startScanner = async (target: 'customer' | 'merchant' = 'customer') => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      alert('Камера доступна только по HTTPS в современном браузере.');
      return;
    }

    stopScanner();
    const session = ++scanSessionRef.current;
    scanTargetRef.current = target;
    setScannerOpen(true);
    setScannerStatus('Запрашиваем доступ к камере…');
    scanLockedRef.current = false;

    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    if (!videoRef.current) {
      setScannerStatus('Не удалось подготовить окно камеры. Попробуйте ещё раз.');
      return;
    }

    try {
      const reader = new BrowserMultiFormatOneDReader();
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (scanResult, _error, liveControls) => {
          if (session !== scanSessionRef.current) { liveControls.stop(); return; }
          controlsRef.current = liveControls;
          if (!scanResult || scanLockedRef.current) return;

          const code = scanResult.getText().replace(/\D/g, '');
          if (!code) return;

          scanLockedRef.current = true;
          setScannerStatus(`Найден штрихкод: ${code}`);

          try {
            liveControls.stop();
          } catch {}
          BrowserMultiFormatOneDReader.releaseAllStreams();

          if ('vibrate' in navigator) navigator.vibrate?.(80);

          if (scanTargetRef.current === 'merchant') {
            setMerchantEan(code);
            setTimeout(() => { if (session === scanSessionRef.current) setScannerOpen(false); }, 180);
          } else {
            setEan(code);
            setObservationEan(code);
            setTimeout(() => {
              if (session !== scanSessionRef.current) return;
              setScannerOpen(false);
              void search(code);
            }, 220);
          }
        },
      );

      if (session !== scanSessionRef.current) { controls.stop(); return; }
      controlsRef.current = controls;
      setScannerStatus('Наведите камеру на штрихкод товара');
    } catch (error: any) {
      if (session !== scanSessionRef.current) return;
      const name = error?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setScannerStatus(
          'Доступ к камере запрещён. Разрешите камеру для этого сайта в Safari и попробуйте снова.',
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setScannerStatus('Камера не найдена на этом устройстве.');
      } else {
        setScannerStatus('Не удалось запустить камеру. Закройте окно и попробуйте снова.');
      }
    }
  };

  const openObservation = () => {
    setObservationEan(ean);
    if (selectedSource !== 'all') setObservationStoreId(selectedSource);
    setObservationTime(localDateTimeValue());
    setObservationMessage('');
    setObserve(true);
  };

  const submitObservation = async () => {
    setObservationMessage('');
    if (!observationStoreId) {
      setObservationMessage('Выберите конкретный магазин.');
      return;
    }
    if (!observationEan) {
      setObservationMessage('Введите или отсканируйте штрихкод.');
      return;
    }
    if (!observationPrice) {
      setObservationMessage('Введите наблюдаемую цену.');
      return;
    }

    setObservationBusy(true);
    try {
      const body = new FormData();
      body.set('store_id', observationStoreId);
      body.set('ean', observationEan);
      body.set('observed_price_kzt', observationPrice);
      body.set('old_price_kzt', observationOldPrice);
      body.set('observed_at', new Date(observationTime).toISOString());
      body.set('comment', observationComment);
      if (observationPhoto) body.set('photo', observationPhoto);

      const response = await fetch('/api/v1/observations', {
        method: 'POST',
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Не удалось сохранить наблюдение.');

      setObservationMessage('Наблюдение сохранено как непроверенное.');
      setObservationPrice('');
      setObservationOldPrice('');
      setObservationComment('');
      setObservationPhoto(null);
      await refreshObservations(observationEan);
      if (result?.official_offers || result?.merchant_offers) {
        await search(observationEan);
      }
    } catch (error: any) {
      setObservationMessage(error?.message || 'Не удалось сохранить наблюдение.');
    } finally {
      setObservationBusy(false);
    }
  };

  const createMerchantStore = async () => {
    setMerchantMessage('');
    if (!storeName.trim()) return setMerchantMessage('Введите название магазина.');
    if (!storeCity.trim()) return setMerchantMessage('Введите город.');
    if (!storeAddress.trim()) return setMerchantMessage('Введите адрес магазина.');

    setMerchantBusy(true);
    try {
      const response = await fetch('/api/v1/stores', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: storeName,
          city: storeCity,
          address: storeAddress,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Не удалось создать магазин.');

      setStoreName('');
      setStoreAddress('');
      setMerchantStoreId(String(data.id));
      setMerchantMessage(`Магазин «${data.name}» создан.`);
      await refreshStores();
      await refreshStoreDirectory();
      await refreshCatalog(String(data.id));
    } catch (error: any) {
      setMerchantMessage(error?.message || 'Ошибка создания магазина.');
    } finally {
      setMerchantBusy(false);
    }
  };

  const addMerchantProduct = async () => {
    setMerchantMessage('');
    if (!merchantStoreId) return setMerchantMessage('Сначала создайте или выберите магазин.');

    if (!merchantPrice.trim()) return setMerchantMessage('Введите цену.');
    setMerchantBusy(true);
    try {
      const response = await fetch(`/api/v1/stores/${merchantStoreId}/products`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ean: merchantEan,
          name: merchantName || undefined,
          price_kzt: Number(merchantPrice),
          old_price_kzt: merchantOldPrice ? Number(merchantOldPrice) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Не удалось сохранить товар.');

      setMerchantEan('');
      setMerchantName('');
      setMerchantPrice('');
      setMerchantOldPrice('');
      setMerchantMessage('Товар и цена сохранены.');
      await refreshCatalog();
      await refreshStores();
    } catch (error: any) {
      setMerchantMessage(error?.message || 'Ошибка сохранения товара.');
    } finally {
      setMerchantBusy(false);
    }
  };

  const importCsv = async (file: File) => {
    setMerchantMessage('');
    if (!merchantStoreId) return setMerchantMessage('Сначала создайте или выберите магазин.');

    setMerchantBusy(true);
    try {
      const items = parseCsv(await file.text());
      const response = await fetch(`/api/v1/stores/${merchantStoreId}/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Импорт не выполнен.');

      setMerchantMessage(`Импортировано товаров: ${data.imported}.`);
      await refreshCatalog();
      await refreshStores();
    } catch (error: any) {
      setMerchantMessage(error?.message || 'Не удалось импортировать CSV.');
    } finally {
      setMerchantBusy(false);
    }
  };

  const downloadTemplate = () => {
    const csv = ['ean,name,price,old_price', '4870207314301,FoodMaster milk 1L,1265,'].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'baga-store-products-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    void refreshStores();
    void refreshStoreDirectory();
    void refreshRetailers();
    return () => {
      scanSessionRef.current += 1;
      try {
        controlsRef.current?.stop?.();
      } catch {}
      BrowserMultiFormatOneDReader.releaseAllStreams();
    };
  }, []);

  useEffect(() => {
    if (merchantStoreId) void refreshCatalog(merchantStoreId);
  }, [merchantStoreId]);

  return (
    <main>
      <header>
        <span className="logo">B</span>
        <div>
          <h1>Baga</h1>
          <p>Сканируй. Узнавай цену.</p>
        </div>
      </header>

      <div className="tabs">
        <button
          className={mode === 'customer' ? 'tab active' : 'tab'}
          onClick={() => setMode('customer')}
        >
          Покупатель
        </button>
        <button
          className={mode === 'merchant' ? 'tab active' : 'tab'}
          onClick={() => setMode('merchant')}
        >
          Для магазина
        </button>
      </div>

      <label>Поиск магазинов по названию, адресу или городу<input value={storeFilter} onChange={e=>setStoreFilter(e.target.value)} placeholder="Найти магазин" /></label>
      {mode === 'customer' ? (
        <>
          <section className="hero">
            <h2>Отсканируйте товар и проверьте доступные цены.</h2>

            <label>
              Источник / магазин
              <select
                value={selectedSource}
                onChange={(event) => {
                  setSelectedSource(event.target.value);
                  setResult(undefined);
                }}
              >
                <option value="all">Все подключённые источники</option>
                {stores.filter(matchesStore).map((store) => (
                  <option value={store.id} key={store.id}>
                    {store.name} — {store.address} · {store.city}
                  </option>
                ))}
              </select>
            </label>

            {selectedSource === 'all' && (
              <label>
                Город для сетевых каталогов
                <select value={city} onChange={(event) => setCity(event.target.value as City)}>
                  <option value="astana">Астана</option>
                  <option value="almaty">Алматы</option>
                </select>
              </label>
            )}

            <label>
              Штрихкод EAN/GTIN
              <input
                inputMode="numeric"
                value={ean}
                onChange={(event) => setEan(event.target.value.replace(/\D/g, ''))}
                placeholder="Например, 4870207314301"
              />
            </label>

            <div className="actions">
              <button onClick={() => void search()} disabled={loading || !ean}>
                {loading ? 'Ищем…' : selectedSource === 'all' ? 'Сравнить цены' : 'Проверить цену'}
              </button>
              <button className="secondary" onClick={() => void startScanner('customer')}>
                Камера
              </button>
            </div>
          </section>

          {result && <ResultView result={result} />}
          {result && selectedSource === 'all' && <button className="secondary" disabled={loading} onClick={() => void search(ean, true)}>Обновить из источника</button>}

          <section className="observation">
            <button className="link" onClick={openObservation}>
              ＋ Добавить наблюдение пользователя
            </button>

            {observe && (
              <div className="form observation-form">
                <label>
                  Магазин
                  <select
                    value={observationStoreId}
                    onChange={(event) => setObservationStoreId(event.target.value)}
                  >
                    <option value="">Выберите конкретный магазин</option>
                    {directoryStores.filter(matchesStore).map((store) => (
                      <option value={store.id} key={store.id}>
                        {store.name} — {store.address} · {store.city}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  inputMode="numeric"
                  value={observationEan}
                  onChange={(event) => setObservationEan(event.target.value.replace(/\D/g, ''))}
                  placeholder="EAN / GTIN"
                />
                <input
                  inputMode="decimal"
                  value={observationPrice}
                  onChange={(event) => setObservationPrice(event.target.value)}
                  placeholder="Наблюдаемая цена, ₸"
                />
                <input
                  inputMode="decimal"
                  value={observationOldPrice}
                  onChange={(event) => setObservationOldPrice(event.target.value)}
                  placeholder="Старая цена, ₸ (необязательно)"
                />
                <input
                  type="datetime-local"
                  value={observationTime}
                  onChange={(event) => setObservationTime(event.target.value)}
                />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setObservationPhoto(event.target.files?.[0] ?? null)}
                />
                <textarea
                  value={observationComment}
                  onChange={(event) => setObservationComment(event.target.value)}
                  placeholder="Комментарий (необязательно)"
                />
                <button onClick={() => void submitObservation()} disabled={observationBusy}>
                  {observationBusy ? 'Сохраняем…' : 'Отправить наблюдение'}
                </button>
                <small>
                  Пользовательское наблюдение хранится отдельно и не заменяет цену магазина или официального каталога.
                </small>
                {observationMessage && <div className="merchant-message">{observationMessage}</div>}
              </div>
            )}
          </section>

          {!!observations.length && (
            <section className="card">
              <h2>Наблюдения пользователей</h2>
              <ObservationList observations={observations} />
            </section>
          )}

          <section className="card">
            <h2>Статус источников</h2>
            <div className="retailer-list">
              {retailers.map((retailer) => (
                <div className="retailer-row" key={retailer.id}>
                  <div>
                    <b>{retailer.name}</b>
                    <small>{retailer.notes}</small>
                  </div>
                  <span className={retailer.integrationStatus === 'active' ? 'status active-status' : 'status'}>
                    {retailer.integrationStatus === 'active' ? 'подключён' : 'исследование'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="merchant-layout">
          <section className="card">
            <h2>1. Создать магазин</h2>
            <p className="muted">Название может повторяться — конкретную точку определяет адрес и внутренний ID.</p>
            <div className="form">
              <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Название магазина *" />
              <input value={storeCity} onChange={(e) => setStoreCity(e.target.value)} placeholder="Город *" />
              <input value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="Адрес магазина *" />
              <button onClick={() => void createMerchantStore()} disabled={merchantBusy}>Создать магазин</button>
            </div>
          </section>

          <section className="card">
            <h2>2. Управление каталогом</h2>
            <label>
              Магазин
              <select value={merchantStoreId} onChange={(e) => setMerchantStoreId(e.target.value)}>
                <option value="">Выберите магазин</option>
                {stores.map((store) => (
                  <option value={store.id} key={store.id}>
                    {store.name} — {store.address} · {store.product_count ?? 0} товаров
                  </option>
                ))}
              </select>
            </label>

            <div className="merchant-grid">
              <div>
                <h3>Добавить один товар</h3>
                <div className="form">
                  <div className="input-with-action">
                    <input
                      inputMode="numeric"
                      value={merchantEan}
                      onChange={(e) => setMerchantEan(e.target.value.replace(/\D/g, ''))}
                      placeholder="EAN / GTIN"
                    />
                    <button className="secondary compact" onClick={() => void startScanner('merchant')}>Скан</button>
                  </div>
                  <input value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="Название (необязательно)" />
                  <input inputMode="decimal" value={merchantPrice} onChange={(e) => setMerchantPrice(e.target.value)} placeholder="Цена, ₸" />
                  <input inputMode="decimal" value={merchantOldPrice} onChange={(e) => setMerchantOldPrice(e.target.value)} placeholder="Старая цена, ₸ (необязательно)" />
                  <button onClick={() => void addMerchantProduct()} disabled={merchantBusy}>Сохранить товар</button>
                </div>
              </div>

              <div>
                <h3>Массовая загрузка CSV</h3>
                <p className="muted">
                  Минимум две колонки: <b>ean</b> и <b>price</b>. Можно добавить <b>name</b> и <b>old_price</b>.
                </p>
                <button className="secondary" onClick={downloadTemplate}>Скачать шаблон CSV</button>
                <label className="upload">
                  Загрузить CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={merchantBusy || !merchantStoreId}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importCsv(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
            {merchantMessage && <div className="merchant-message">{merchantMessage}</div>}
          </section>

          <section className="card">
            <div className="catalog-title">
              <h2>3. Товары магазина</h2>
              <span>{catalog.length}</span>
            </div>
            {catalog.length ? (
              <div className="catalog">
                {catalog.slice(0, 100).map((item) => (
                  <div className="catalog-row" key={item.ean}>
                    <div>
                      <b>{item.name}</b>
                      <small>{item.ean}</small>
                    </div>
                    <strong>{item.price_kzt} ₸</strong>
                    <small>{new Date(item.updated_at).toLocaleString('ru-RU')}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Пока товаров нет. Добавьте товар или загрузите CSV.</p>
            )}
          </section>
        </div>
      )}

      {scannerOpen && (
        <div className="scanner-backdrop" role="dialog" aria-modal="true">
          <div className="scanner-modal">
            <div className="scanner-head">
              <div>
                <b>Сканирование штрихкода</b>
                <p>{scannerStatus}</p>
              </div>
              <button className="scanner-close" onClick={stopScanner} aria-label="Закрыть камеру">×</button>
            </div>
            <div className="scanner-video-wrap">
              <video ref={videoRef} className="scanner-video" autoPlay muted playsInline />
              <div className="scanner-frame" aria-hidden="true" />
            </div>
            <small>Держите штрихкод горизонтально и заполните им рамку.</small>
          </div>
        </div>
      )}
    </main>
  );
}

function ResultView({ result }: { result: any }) {
  if (result.status === 'invalid') {
    return <section className="card error"><h2>Проверьте данные</h2><p>{result.message}</p></section>;
  }

  if (result.official_offers || result.merchant_offers) {
    if (result.status === 'not_found') {
      return (
        <section className="card empty">
          <h2>Товар пока не найден</h2>
          <p>{result.source_errors?.length ? 'Источник временно недоступен. Повторите поиск.' : 'Ни один подключённый источник не вернул цену по этому EAN/GTIN.'}</p>
        </section>
      );
    }

    return (
      <section className="card">
        <div className="badges">
          <span>EAN {result.ean}</span>
          <span>{result.city === 'astana' ? 'Астана' : 'Алматы'}</span>
        </div>
        <h2>{result.product?.name ?? 'Товар найден'}</h2>
        <p className="meta">
          {[result.product?.brand, result.product?.pack].filter(Boolean).join(' · ')}
        </p>

        <h3>Официальные источники</h3>
        {result.official_offers?.length ? (
          <OfferList offers={result.official_offers} label="OFFICIAL RETAILER" />
        ) : (
          <p className="muted">Подтверждённых официальных цен пока нет.</p>
        )}

        <h3>Цены, загруженные магазинами</h3>
        {result.merchant_offers?.length ? (
          <OfferList offers={result.merchant_offers} label="MERCHANT PROVIDED" />
        ) : (
          <p className="muted">Магазины ещё не загрузили цену для этого товара.</p>
        )}

        {!!result.observations?.length && (
          <>
            <h3>Наблюдения пользователей</h3>
            <ObservationList observations={result.observations} />
          </>
        )}

        {!!result.source_errors?.length && (
          <div className="warning">
            Некоторые источники временно недоступны. Это не означает, что товара там нет.
          </div>
        )}
      </section>
    );
  }

  if (result.status === 'not_found') {
    return (
      <section className="card empty">
        <h2>Товар не найден</h2>
        <p>{result.message}</p>
        {result.store && <p className="meta">{result.store.name} — {result.store.address}, {result.store.city}</p>}
      </section>
    );
  }

  if (result.status !== 'found') {
    return <section className="card error"><h2>Источник недоступен</h2><p>{result.message}</p></section>;
  }

  return (
    <section className="card">
      <div className="badges">
        <span>{result.store?.name ?? 'Магазин'}</span>
        <span>{result.store?.city}</span>
        <span>{result.available ? 'В наличии' : 'Нет в наличии'}</span>
      </div>
      <h2>{result.title}</h2>
      <p className="meta">{[result.brand, result.pack].filter(Boolean).join(' · ')}</p>
      <div className="price">
        {result.price_kzt} ₸ <del>{result.old_price_kzt ? `${result.old_price_kzt} ₸` : ''}</del>
      </div>
      <p>{result.store?.address}, {result.store?.city}</p>
      <p>Цена обновлена: {new Date(result.source_updated_at).toLocaleString('ru-RU')}</p>
      <div className="warning"><b>MERCHANT PROVIDED · Неофициальный каталог. Цена внесена пользователем merchant-режима; владение магазином не проверено.</b></div>
    </section>
  );
}

function OfferList({ offers, label }: { offers: any[]; label: string }) {
  return (
    <div className="offers">
      {offers.map((offer, index) => (
        <div className="offer-row" key={`${offer.retailer_id ?? offer.store_id}-${index}`}>
          <div>
            <span className="source-label">{label}{label === 'MERCHANT PROVIDED' ? ' · НЕОФИЦИАЛЬНЫЙ' : ''}</span>
            <small>{offer.freshness === 'stale' ? 'Устаревшие данные' : offer.freshness === 'fresh' ? 'Свежие данные' : 'Свежесть неизвестна'}</small>
            <b>{offer.retailer_name ?? offer.store_name}</b>
            <small>
              {offer.store_name && offer.retailer_name ? `${offer.store_name} · ` : ''}
              {offer.store_address ? `${offer.store_address} · ` : ''}
              {offer.city ?? ''}
            </small>
            <small>
              {offer.source_updated_at ? `Обновлено: ${new Date(offer.source_updated_at).toLocaleString('ru-RU')}` : `Получено: ${new Date(offer.retrieved_at).toLocaleString('ru-RU')}. Время обновления источника неизвестно.`}
            </small>
          </div>
          <div className="warning">{offer.warnings?.join(' ')}</div>
          <div className="offer-price">
            <strong>{offer.price_kzt} ₸</strong>
            {offer.old_price_kzt ? <del>{offer.old_price_kzt} ₸</del> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ObservationList({ observations }: { observations: any[] }) {
  return (
    <div className="offers">
      {observations.map((observation) => (
        <div className="offer-row" key={observation.id}>
          <div>
            <span className="source-label user-source">USER REPORTED · {observation.status === 'verified' ? 'ПРОВЕРЕНО МОДЕРАТОРОМ' : 'НЕ ПРОВЕРЕНО'}</span>
            <b>{observation.store_name}</b>
            <small>{observation.store_address} · {observation.store_city}</small>
            <small>{new Date(observation.observed_at).toLocaleString('ru-RU')}</small>
            {observation.comment && <small>{observation.comment}</small>}
            {observation.photo_url && (
              <a href={observation.photo_url} target="_blank" rel="noreferrer">Фото наблюдения</a>
            )}
          </div>
          <div className="offer-price">
            <strong>{observation.price_kzt} ₸</strong>
            {observation.old_price_kzt ? <del>{observation.old_price_kzt} ₸</del> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
