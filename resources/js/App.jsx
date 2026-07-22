import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCodeStyling from 'qr-code-styling';
import JSZip from 'jszip';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  PointElement,
  LineElement
} from 'chart.js';
import kaiLogo from './assets/kai-logo.svg';

// Daftarkan komponen Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend
);

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

// Helper: Seeded Random Generator untuk Tren Grafik yang Konsisten
const getSeededRandom = (seed) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
};

// Helper: Distribusikan Klik Secara Deterministik Selama 7 Hari Terakhir
const generateTrendData = (totalClicks, seed, createdAt) => {
  if (totalClicks === 0) return [0, 0, 0, 0, 0, 0, 0];
  
  const rng = getSeededRandom(seed || 'kai-default');
  const days = 7;
  const createdDate = createdAt ? new Date(createdAt) : null;
  
  // Hitung tanggal masing-masing hari dari 7 hari terakhir
  const dayDates = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0); // normalkan waktu ke awal hari
    dayDates.push(d);
  }
  
  // Buat bobot acak dasar, beri bobot 0 jika hari tersebut sebelum tanggal pembuatan link
  let weights = [];
  let sumWeights = 0;
  for (let i = 0; i < days; i++) {
    const normalizedCreated = createdDate ? new Date(createdDate).setHours(0, 0, 0, 0) : 0;
    if (createdDate && dayDates[i].getTime() < normalizedCreated) {
      weights.push(0);
    } else {
      const w = 0.4 + rng() * 1.6; 
      weights.push(w);
      sumWeights += w;
    }
  }
  
  // Jika semua bobot 0, setel hari terakhir (hari ini) memiliki bobot 1
  if (sumWeights === 0) {
    weights[6] = 1;
    sumWeights = 1;
  }
  
  // Normalisasi & Distribusikan total klik
  let distributed = weights.map(w => Math.round((w / sumWeights) * totalClicks));
  
  // Koreksi pembulatan agar totalnya sama persis dengan totalClicks
  let currentSum = distributed.reduce((a, b) => a + b, 0);
  let diff = totalClicks - currentSum;
  
  let index = 0;
  const validIndices = [];
  for (let i = 0; i < days; i++) {
    if (weights[i] > 0) validIndices.push(i);
  }
  if (validIndices.length === 0) validIndices.push(6);
  
  while (diff !== 0) {
    const idx = validIndices[index % validIndices.length];
    if (diff > 0) {
      distributed[idx]++;
      diff--;
    } else {
      if (distributed[idx] > 0) {
        distributed[idx]--;
        diff++;
      } else {
        index++;
      }
    }
    index++;
  }
  
  return distributed;
};

// Helper: Membungkus Teks untuk Canvas Cetak Poster
const wrapCanvasText = (context, text, x, y, maxWidth, lineHeight) => {
  const words = text.split(' ');
  let line = '';
  let lines = [];
  
  for (let n = 0; n < words.length; n++) {
    let testLine = line + words[n] + ' ';
    let metrics = context.measureText(testLine);
    let testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      lines.push(line);
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line);
  return lines;
};

function App() {
  // 1. States dasar shortener
  const [longUrl, setLongUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiryOption, setExpiryOption] = useState('forever');
  const [customExpiry, setCustomExpiry] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [links, setLinks] = useState([]);
  
  // Status koneksi ke backend
  const [backendOnline, setBackendOnline] = useState(false);
  const [checkingBackend, setCheckingBackend] = useState(true);

  // Prefix domain dinamis (misal: "qrku-alpha.kai.id/r/" atau "localhost:8000/r/")
  const domainPrefix = useMemo(() => {
    try {
      const base = import.meta.env.VITE_API_BASE || window.location.origin;
      const url = new URL(base);
      return `${url.host}/r/`;
    } catch (e) {
      return `${window.location.host}/r/`;
    }
  }, []);

  // 2. Mode Gelap / Terang
  const [theme, setTheme] = useState(localStorage.getItem('kai_theme') || 'light');

  // 3. States QR Code Customizer
  const [selectedLink, setSelectedLink] = useState(null);
  const [dotType, setDotType] = useState('rounded');
  const [qrColorType, setQrColorType] = useState('solid'); // 'solid' atau 'gradient'
  const [qrColorSolid, setQrColorSolid] = useState('#0D3A6F'); // Default KAI Blue
  const [qrColorGradStart, setQrColorGradStart] = useState('#0D3A6F');
  const [qrColorGradEnd, setQrColorGradEnd] = useState('#ED6C25'); // KAI Orange
  const [hasLogo, setHasLogo] = useState(true);

  // Kustomisasi sudut (Eye) QR Code lebih detail
  const [customCorners, setCustomCorners] = useState(false);
  const [cornersSquareType, setCornersSquareType] = useState('rounded'); // 'square', 'dot', 'extra-rounded', 'rounded'
  const [cornersDotType, setCornersDotType] = useState('dot'); // 'square', 'dot', 'rounded'
  const [cornersSquareColor, setCornersSquareColor] = useState('#0D3A6F');
  const [cornersDotColor, setCornersDotColor] = useState('#ED6C25');

  // 4. Pencarian, Filter & Sortir
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'popular', 'unclicked'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'clicks_desc', 'clicks_asc'

  // 5. Ekspor QR Code Massal (Batch Download)
  const [selectedLinkIds, setSelectedLinkIds] = useState([]);
  const [isZipping, setIsZipping] = useState(false);

  // 6. Poster Generator Modal
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [posterTitle, setPosterTitle] = useState('Pindai di Sini untuk Jadwal KA');
  const [posterSubtitle, setPosterSubtitle] = useState('Gunakan kamera handphone atau aplikasi Access by KAI');
  const [posterStation, setPosterStation] = useState('Stasiun Gambir');
  const [posterTheme, setPosterTheme] = useState('blue'); // 'blue', 'orange', 'eco'
  const [posterQrImgUrl, setPosterQrImgUrl] = useState('');
  const [generatingPosterPng, setGeneratingPosterPng] = useState(false);

  // Ref untuk element canvas QR Code
  const qrRef = useRef(null);
  const qrCodeInstance = useRef(null);

  // Efek perubahan tema (Dark / Light Mode)
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
    localStorage.setItem('kai_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // 1. Ambil daftar link
  const fetchLinks = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/links`);
      const data = await response.json();
      if (data.success) {
        setLinks(data.data);
        setBackendOnline(true);
      }
    } catch (error) {
      console.warn('Backend offline, beralih ke Mode Local Storage:', error.message);
      setBackendOnline(false);
      const localLinks = JSON.parse(localStorage.getItem('kai_links') || '[]');
      setLinks(localLinks);
    } finally {
      setCheckingBackend(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  // 2. Efek untuk menggambar/update QR Code secara dinamis
  useEffect(() => {
    if (!selectedLink) return;

    if (qrRef.current) {
      qrRef.current.innerHTML = '';
    }

    // Bangun opsi styling untuk QR Code
    const qrOptions = {
      width: 260,
      height: 260,
      type: 'svg',
      data: selectedLink.longUrl,
      image: hasLogo ? kaiLogo : '',
      dotsOptions: {
        type: dotType,
        color: qrColorType === 'solid' ? qrColorSolid : undefined,
        gradient: qrColorType === 'gradient' ? {
          type: 'linear',
          rotation: 45,
          colorStops: [
            { offset: 0, color: qrColorGradStart },
            { offset: 1, color: qrColorGradEnd }
          ]
        } : undefined
      },
      backgroundOptions: {
        color: '#FFFFFF',
      },
      imageOptions: {
        crossOrigin: 'anonymous',
        margin: 6,
        imageSizeFactor: 0.4
      },
      cornersSquareOptions: {
        type: cornersSquareType,
        color: customCorners ? cornersSquareColor : (qrColorType === 'solid' ? qrColorSolid : qrColorGradStart)
      },
      cornersDotOptions: {
        type: cornersDotType,
        color: customCorners ? cornersDotColor : (qrColorType === 'solid' ? qrColorSolid : qrColorGradEnd)
      }
    };

    qrCodeInstance.current = new QRCodeStyling(qrOptions);
    qrCodeInstance.current.append(qrRef.current);
  }, [
    selectedLink, 
    dotType, 
    cornersSquareType, 
    cornersDotType, 
    qrColorType, 
    qrColorSolid, 
    qrColorGradStart, 
    qrColorGradEnd, 
    hasLogo,
    customCorners,
    cornersSquareColor,
    cornersDotColor
  ]);

  // Efek untuk memuat QR Code beresolusi tinggi ke dalam poster preview modal
  useEffect(() => {
    if (!selectedLink) return;
    
    const qrOptions = {
      width: 400,
      height: 400,
      type: 'svg',
      data: selectedLink.longUrl,
      image: hasLogo ? kaiLogo : '',
      dotsOptions: {
        type: dotType,
        color: qrColorType === 'solid' ? qrColorSolid : undefined,
        gradient: qrColorType === 'gradient' ? {
          type: 'linear',
          rotation: 45,
          colorStops: [
            { offset: 0, color: qrColorGradStart },
            { offset: 1, color: qrColorGradEnd }
          ]
        } : undefined
      },
      backgroundOptions: { color: '#FFFFFF' },
      imageOptions: {
        crossOrigin: 'anonymous',
        margin: 10,
        imageSizeFactor: 0.4
      },
      cornersSquareOptions: {
        type: cornersSquareType,
        color: customCorners ? cornersSquareColor : (qrColorType === 'solid' ? qrColorSolid : qrColorGradStart)
      },
      cornersDotOptions: {
        type: cornersDotType,
        color: customCorners ? cornersDotColor : (qrColorType === 'solid' ? qrColorSolid : qrColorGradEnd)
      }
    };
    
    const tempQr = new QRCodeStyling(qrOptions);
    tempQr.getRawData('png').then(blob => {
      // Bebaskan URL objek sebelumnya jika ada
      if (posterQrImgUrl && posterQrImgUrl.startsWith('blob:')) {
        URL.revokeObjectURL(posterQrImgUrl);
      }
      const url = URL.createObjectURL(blob);
      setPosterQrImgUrl(url);
    });
  }, [
    selectedLink, 
    dotType, 
    cornersSquareType, 
    cornersDotType, 
    qrColorType, 
    qrColorSolid, 
    qrColorGradStart, 
    qrColorGradEnd, 
    hasLogo,
    customCorners,
    cornersSquareColor,
    cornersDotColor
  ]);

  // Cleanup blob URL saat unmount
  useEffect(() => {
    return () => {
      if (posterQrImgUrl && posterQrImgUrl.startsWith('blob:')) {
        URL.revokeObjectURL(posterQrImgUrl);
      }
    };
  }, [posterQrImgUrl]);

  // 3. Aksi memperpendek URL (Submit Form)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!longUrl) return;

    setLoading(true);
    showAlert(false);

    const payload = {
      longUrl,
      customAlias: customAlias || undefined,
      expiryOption,
      customExpiry: customExpiry || undefined
    };

    if (backendOnline) {
      try {
        const response = await fetch(`${API_BASE}/api/shorten`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (data.success) {
          setLongUrl('');
          setCustomAlias('');
          setExpiryOption('forever');
          setCustomExpiry('');
          fetchLinks();
          setSelectedLink(data.data);
          showAlert(true, 'success', 'Link berhasil diperpendek!');
        } else {
          showAlert(true, 'error', data.message || 'Gagal membuat link.');
        }
      } catch (error) {
        showAlert(true, 'error', 'Gagal terhubung ke server.');
      } finally {
        setLoading(false);
      }
    } else {
      // OFFLINE MODE
      setTimeout(() => {
        const code = customAlias.trim() || Math.random().toString(36).substring(2, 8);
        const localLinks = JSON.parse(localStorage.getItem('kai_links') || '[]');
        const isDuplicate = localLinks.some(l => l.id.toLowerCase() === code.toLowerCase());
        
        if (isDuplicate && customAlias) {
          showAlert(true, 'error', 'Custom alias sudah digunakan di local storage!');
          setLoading(false);
          return;
        }

        let localExpiresAt = null;
        if (expiryOption === '1_hour') {
          localExpiresAt = new Date(Date.now() + 3600000).toISOString();
        } else if (expiryOption === '1_day') {
          localExpiresAt = new Date(Date.now() + 86400000).toISOString();
        } else if (expiryOption === '7_days') {
          localExpiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
        } else if (expiryOption === '30_days') {
          localExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
        } else if (expiryOption === 'custom' && customExpiry) {
          localExpiresAt = new Date(customExpiry).toISOString();
        }

        const newLink = {
          id: code,
          longUrl,
          shortUrl: `${API_BASE}/r/${code}`,
          clicks: 0,
          createdAt: new Date().toISOString(),
          expiresAt: localExpiresAt
        };

        const updatedLinks = [newLink, ...localLinks];
        localStorage.setItem('kai_links', JSON.stringify(updatedLinks));
        setLinks(updatedLinks);
        
        setLongUrl('');
        setCustomAlias('');
        setExpiryOption('forever');
        setCustomExpiry('');
        setSelectedLink(newLink);
        showAlert(true, 'success', 'Link berhasil diperpendek (Mode Offline Local Storage)!');
        setLoading(false);
      }, 500);
    }
  };

  // 4. Aksi menghapus link
  const handleDelete = async (id) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus link pendek "${id}"?`)) return;

    if (backendOnline) {
      try {
        const response = await fetch(`${API_BASE}/api/links/${id}`, {
          method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
          if (selectedLink && selectedLink.id === id) {
            setSelectedLink(null);
          }
          setSelectedLinkIds(prev => prev.filter(x => x !== id));
          fetchLinks();
          showAlert(true, 'success', 'Link berhasil dihapus.');
        } else {
          showAlert(true, 'error', data.message || 'Gagal menghapus link.');
        }
      } catch (error) {
        showAlert(true, 'error', 'Koneksi ke backend bermasalah.');
      }
    } else {
      const localLinks = JSON.parse(localStorage.getItem('kai_links') || '[]');
      const updated = localLinks.filter(link => link.id !== id);
      localStorage.setItem('kai_links', JSON.stringify(updated));
      setLinks(updated);
      setSelectedLinkIds(prev => prev.filter(x => x !== id));
      if (selectedLink && selectedLink.id === id) {
        setSelectedLink(null);
      }
      showAlert(true, 'success', 'Link berhasil dihapus dari local storage.');
    }
  };

  // 5. Download Single QR Code
  const downloadQR = (ext) => {
    if (!qrCodeInstance.current || !selectedLink) return;
    qrCodeInstance.current.download({
      name: `kai-qr-${selectedLink.id}`,
      extension: ext
    });
  };

  // Helper Alert
  const showAlert = (show, type = '', message = '') => {
    setAlert({ show, type, message });
    if (show && type === 'success') {
      setTimeout(() => setAlert(prev => ({ ...prev, show: false })), 4000);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showAlert(true, 'success', 'Link pendek berhasil disalin ke clipboard!');
  };

  // Logic: Search, Filter & Sort memoized
  const processedLinks = useMemo(() => {
    let tempLinks = [...links];

    // Search
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      tempLinks = tempLinks.filter(link => 
        link.id.toLowerCase().includes(query) || 
        link.longUrl.toLowerCase().includes(query)
      );
    }

    // Filter
    if (filterType === 'popular') {
      tempLinks = tempLinks.filter(link => link.clicks >= 10);
    } else if (filterType === 'unclicked') {
      tempLinks = tempLinks.filter(link => link.clicks === 0);
    }

    // Sort
    if (sortBy === 'newest') {
      tempLinks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'oldest') {
      tempLinks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === 'clicks_desc') {
      tempLinks.sort((a, b) => b.clicks - a.clicks);
    } else if (sortBy === 'clicks_asc') {
      tempLinks.sort((a, b) => a.clicks - b.clicks);
    }

    return tempLinks;
  }, [links, searchQuery, filterType, sortBy]);

  // Batch Selection Handlers
  const handleSelectLink = (id) => {
    setSelectedLinkIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLinkIds(processedLinks.map(l => l.id));
    } else {
      setSelectedLinkIds([]);
    }
  };

  // Unduh Massal Batch (.zip)
  const handleBatchDownload = async () => {
    if (selectedLinkIds.length === 0) return;
    setIsZipping(true);
    showAlert(true, 'success', `Mempersiapkan zip untuk ${selectedLinkIds.length} QR Code...`);

    try {
      const zip = new JSZip();
      
      for (const id of selectedLinkIds) {
        const linkObj = links.find(l => l.id === id);
        if (!linkObj) continue;

        const qrOptions = {
          width: 500,
          height: 500,
          type: 'svg',
          data: linkObj.longUrl,
          image: hasLogo ? kaiLogo : '',
          dotsOptions: {
            type: dotType,
            color: qrColorType === 'solid' ? qrColorSolid : undefined,
            gradient: qrColorType === 'gradient' ? {
              type: 'linear',
              rotation: 45,
              colorStops: [
                { offset: 0, color: qrColorGradStart },
                { offset: 1, color: qrColorGradEnd }
              ]
            } : undefined
          },
          backgroundOptions: {
            color: '#FFFFFF',
          },
          imageOptions: {
            crossOrigin: 'anonymous',
            margin: 12,
            imageSizeFactor: 0.4
          },
          cornersSquareOptions: {
            type: cornersSquareType,
            color: customCorners ? cornersSquareColor : (qrColorType === 'solid' ? qrColorSolid : qrColorGradStart)
          },
          cornersDotOptions: {
            type: cornersDotType,
            color: customCorners ? cornersDotColor : (qrColorType === 'solid' ? qrColorSolid : qrColorGradEnd)
          }
        };

        const qrObj = new QRCodeStyling(qrOptions);
        const blob = await qrObj.getRawData('png');
        zip.file(`kai-qr-${id}.png`, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kai-qr-batch-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showAlert(true, 'success', `Sukses mengunduh ${selectedLinkIds.length} QR Code!`);
      setSelectedLinkIds([]);
    } catch (err) {
      console.error(err);
      showAlert(true, 'error', 'Gagal membuat file ZIP unduhan.');
    } finally {
      setIsZipping(false);
    }
  };

  // Cetak Poster (A4 window.print)
  const handlePrintPoster = () => {
    document.body.className = `print-theme-${posterTheme}`;
    window.print();
    // Kembalikan class tema normal setelah mencetak
    document.body.className = theme === 'dark' ? 'dark-theme' : '';
  };

  // Unduh Poster PNG (Canvas Drawing)
  const handleDownloadPosterPng = () => {
    if (!selectedLink || !posterQrImgUrl) return;
    setGeneratingPosterPng(true);

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1700;
    const ctx = canvas.getContext('2d');

    const isEco = posterTheme === 'eco';
    const isOrange = posterTheme === 'orange';
    const isBlue = posterTheme === 'blue';

    // 1. Draw Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!isEco) {
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.75, '#FFFFFF');
      grad.addColorStop(1, isOrange ? '#fffdf9' : '#f0f5fa');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Draw border
    const borderThickness = isEco ? 15 : 40;
    const borderColor = isEco ? '#1e293b' : (isOrange ? '#ED6C25' : '#0D3A6F');
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderThickness;
    ctx.strokeRect(borderThickness / 2, borderThickness / 2, canvas.width - borderThickness, canvas.height - borderThickness);

    // 3. Load Images & Draw Elements
    const logoImg = new Image();
    const qrImg = new Image();
    let loadedCount = 0;

    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        // Draw Logo
        const logoHeight = 70;
        const logoWidth = logoHeight * 2.3;
        ctx.drawImage(logoImg, (canvas.width - logoWidth) / 2, 100, logoWidth, logoHeight);

        // Draw Header Text
        ctx.font = '800 60px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = borderColor;
        ctx.fillText('PINDAI DI SINI', canvas.width / 2, 235);

        // Draw QR Container Card
        const qrBoxSize = 530;
        const qrBoxX = (canvas.width - qrBoxSize) / 2;
        const qrBoxY = 310;

        ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;

        ctx.fillStyle = '#FFFFFF';
        const r = 24;
        ctx.beginPath();
        ctx.moveTo(qrBoxX + r, qrBoxY);
        ctx.lineTo(qrBoxX + qrBoxSize - r, qrBoxY);
        ctx.quadraticCurveTo(qrBoxX + qrBoxSize, qrBoxY, qrBoxX + qrBoxSize, qrBoxY + r);
        ctx.lineTo(qrBoxX + qrBoxSize, qrBoxY + qrBoxSize - r);
        ctx.quadraticCurveTo(qrBoxX + qrBoxSize, qrBoxY + qrBoxSize, qrBoxX + qrBoxSize - r, qrBoxY + qrBoxSize);
        ctx.lineTo(qrBoxX + r, qrBoxY + qrBoxSize);
        ctx.quadraticCurveTo(qrBoxX, qrBoxY + qrBoxSize, qrBoxX, qrBoxY + qrBoxSize - r);
        ctx.lineTo(qrBoxX, qrBoxY + r);
        ctx.quadraticCurveTo(qrBoxX, qrBoxY, qrBoxX + r, qrBoxY);
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Stroke QR Box
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw QR Code
        const qrSize = 450;
        ctx.drawImage(qrImg, qrBoxX + 40, qrBoxY + 40, qrSize, qrSize);

        // Footer Title
        ctx.fillStyle = '#1e293b';
        ctx.font = '700 46px Outfit, sans-serif';
        const titleLines = wrapCanvasText(ctx, posterTitle, canvas.width / 2, 930, 850, 58);
        let currentY = 930;
        titleLines.forEach(line => {
          ctx.fillText(line.trim(), canvas.width / 2, currentY);
          currentY += 58;
        });

        // Footer Subtitle
        ctx.fillStyle = '#64748b';
        ctx.font = '500 26px Outfit, sans-serif';
        currentY += 15;
        const subLines = wrapCanvasText(ctx, posterSubtitle, canvas.width / 2, currentY, 850, 36);
        subLines.forEach(line => {
          ctx.fillText(line.trim(), canvas.width / 2, currentY);
          currentY += 36;
        });

        // Station Badge Capsule
        currentY += 45;
        ctx.font = 'bold 28px Outfit, sans-serif';
        const stationText = posterStation.toUpperCase();
        const textWidth = ctx.measureText(stationText).width;
        const badgeHeight = 60;
        const badgeWidth = textWidth + 60;
        const badgeX = (canvas.width - badgeWidth) / 2;
        const badgeY = currentY;

        ctx.fillStyle = borderColor;
        const br = 30; // capsule radius
        ctx.beginPath();
        ctx.moveTo(badgeX + br, badgeY);
        ctx.lineTo(badgeX + badgeWidth - br, badgeY);
        ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + br);
        ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - br, badgeY + badgeHeight);
        ctx.lineTo(badgeX + br, badgeY + badgeHeight);
        ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + br);
        ctx.quadraticCurveTo(badgeX, badgeY, badgeX + br, badgeY);
        ctx.closePath();
        ctx.fill();

        // Badge Text
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stationText, canvas.width / 2, badgeY + (badgeHeight / 2));

        // Save
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `poster-${selectedLink.id}-${posterStation.toLowerCase().replace(/\s+/g, '-')}.png`;
        a.click();
        setGeneratingPosterPng(false);
      }
    };

    logoImg.onload = checkAllLoaded;
    qrImg.onload = checkAllLoaded;

    logoImg.onerror = () => { loadedCount++; if (loadedCount === 2) checkAllLoaded(); };
    qrImg.onerror = () => { loadedCount++; if (loadedCount === 2) checkAllLoaded(); };

    logoImg.src = kaiLogo;
    qrImg.src = posterQrImgUrl;
  };

  // Logic: Grafik interaktif Chart.js
  const chartData = useMemo(() => {
    let rawClicks = 0;
    let labelText = 'Semua Link';
    let clicksTrend = [0, 0, 0, 0, 0, 0, 0];

    // Hitung label hari dan inisialisasi count map
    const labels = [];
    const date = new Date();
    const daysMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(date.getDate() - i);
      const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      labels.push(label);
      daysMap[label] = 0;
    }

    if (selectedLink) {
      rawClicks = selectedLink.clicks;
      const shortDisplay = selectedLink.shortUrl 
        ? selectedLink.shortUrl.replace(/^https?:\/\//, '') 
        : `${domainPrefix}${selectedLink.id}`;
      labelText = `Link: ${shortDisplay}`;
      
      if (selectedLink.clickHistory) {
        selectedLink.clickHistory.forEach(timestamp => {
          const clickDate = new Date(timestamp);
          const label = clickDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
          if (daysMap[label] !== undefined) {
            daysMap[label]++;
          }
        });
        clicksTrend = labels.map(label => daysMap[label]);
      } else {
        clicksTrend = generateTrendData(rawClicks, selectedLink.id, selectedLink.createdAt);
      }
    } else {
      rawClicks = links.reduce((sum, l) => sum + l.clicks, 0);
      labelText = 'Total Klik Semua Link';
      
      const hasRealHistory = links.some(l => l.clickHistory !== undefined);
      if (hasRealHistory) {
        links.forEach(l => {
          if (l.clickHistory) {
            l.clickHistory.forEach(timestamp => {
              const clickDate = new Date(timestamp);
              const label = clickDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
              if (daysMap[label] !== undefined) {
                daysMap[label]++;
              }
            });
          }
        });
        clicksTrend = labels.map(label => daysMap[label]);
      } else {
        clicksTrend = generateTrendData(rawClicks, 'all-links-cumulative');
      }
    }

    return {
      labels,
      datasets: [
        {
          label: labelText,
          data: clicksTrend,
          backgroundColor: theme === 'dark' ? 'rgba(237, 108, 37, 0.85)' : 'rgba(13, 58, 111, 0.85)',
          borderColor: theme === 'dark' ? '#ED6C25' : '#0D3A6F',
          borderWidth: 1,
          borderRadius: 6,
          hoverBackgroundColor: theme === 'dark' ? '#ED6C25' : '#0D3A6F',
        }
      ]
    };
  }, [selectedLink, links, theme]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: theme === 'dark' ? '#cbd5e1' : '#1e293b',
          font: { family: 'Outfit', weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#1e293b' : '#0D3A6F',
        titleFont: { family: 'Outfit', size: 13 },
        bodyFont: { family: 'Outfit', size: 14, weight: 'bold' },
        padding: 10,
        cornerRadius: 8,
        displayColors: false
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          font: { family: 'Outfit', size: 11 }
        }
      },
      y: {
        grid: {
          color: theme === 'dark' ? '#334155' : '#e2e8f0',
        },
        ticks: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          font: { family: 'Outfit', size: 11 },
          stepSize: 1,
          precision: 0
        }
      }
    }
  };

  // Menghitung statistik global dashboard analytics
  const totalClicksAll = links.reduce((sum, l) => sum + l.clicks, 0);
  const mostPopularLink = useMemo(() => {
    if (links.length === 0) return null;
    return [...links].sort((a, b) => b.clicks - a.clicks)[0];
  }, [links]);

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header">
        <div className="header-brand">
          <img src={kaiLogo} alt="KAI Logo" className="header-logo" />
          <div className="header-title-container">
            <h1>KAI Link & QR Manager</h1>
            <p>Link Shortener + QR Code Generator Resmi PT KAI</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className={`badge-online ${backendOnline ? '' : 'offline'}`} style={backendOnline ? {} : {background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626'}}>
            <div className="badge-dot" style={backendOnline ? {} : {backgroundColor: '#EF4444', boxShadow: '0 0 8px #EF4444'}}></div>
            {checkingBackend ? 'Memeriksa Server...' : backendOnline ? 'Server SQLite Online' : 'Offline Mode (Local Storage)'}
          </div>

          <button onClick={toggleTheme} className="theme-toggle-btn" title="Ganti Mode Warna">
            {theme === 'light' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            )}
          </button>
        </div>
      </header>

      {/* ALERT */}
      {alert.show && (
        <div className={`alert-message ${alert.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {alert.message}
        </div>
      )}

      {/* DASHBOARD GRID */}
      <div className="dashboard-grid">
        {/* KOLOM KIRI: FORM INPUT */}
        <div className="card">
          <h2 className="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            Perpendek URL Baru
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="long-url">Masukkan URL Panjang</label>
              <input
                id="long-url"
                type="url"
                required
                className="form-input"
                placeholder="Contoh: https://booking.kai.id/promosi-mudik-lebaran-2026"
                value={longUrl}
                onChange={(e) => setLongUrl(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="custom-alias">Custom Alias (Opsional)</label>
              <div className="alias-input-wrapper">
                <span className="alias-prefix">{domainPrefix}</span>
                <input
                  id="custom-alias"
                  type="text"
                  className="alias-input"
                  placeholder="misal: tiket-mudik"
                  value={customAlias}
                  onChange={(e) => setCustomAlias(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                />
              </div>
              <small style={{display: 'block', color: 'var(--text-light)', marginTop: '0.4rem', fontSize: '0.8rem'}}>
                Hanya huruf, angka, tanda hubung (-) dan garis bawah (_) yang diperbolehkan.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="expiry-option">Masa Aktif Link & QR</label>
              <select
                id="expiry-option"
                className="form-input"
                value={expiryOption}
                onChange={(e) => {
                  setExpiryOption(e.target.value);
                  if (e.target.value !== 'custom') {
                    setCustomExpiry('');
                  }
                }}
              >
                <option value="forever">Selamanya (Tidak Ada Batasan)</option>
                <option value="1_hour">1 Jam</option>
                <option value="1_day">1 Hari</option>
                <option value="7_days">7 Hari</option>
                <option value="30_days">30 Hari</option>
                <option value="custom">Kustom Tanggal & Waktu</option>
              </select>
            </div>

            {expiryOption === 'custom' && (
              <div className="form-group expiry-custom-container">
                <label className="form-label" htmlFor="custom-expiry">Pilih Waktu Kadaluarsa</label>
                <input
                  id="custom-expiry"
                  type="datetime-local"
                  required
                  className="form-input"
                  value={customExpiry}
                  min={new Date(new Date().getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0, 16)}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                />
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? (
                <>
                  <span className="spinner"></span> Memproses...
                </>
              ) : (
                'Perpendek & Buat QR'
              )}
            </button>
          </form>

          {/* PANEL HASIL SHORTEN */}
          {selectedLink && (
            <div className="result-panel">
              <div className="result-title">Link Pendek Hasil Pembuatan:</div>
              <div className="result-url-box">
                <a href={selectedLink.shortUrl} target="_blank" rel="noopener noreferrer" className="result-url">
                  {selectedLink.shortUrl}
                </a>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                  <button onClick={() => copyToClipboard(selectedLink.shortUrl)} className="btn btn-outline btn-sm">
                    Salin Link
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* KOLOM KANAN: QR CODE STUDIO */}
        <div className="card" style={{display: 'flex', flexDirection: 'column'}}>
          <h2 className="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            KAI QR Code Studio
          </h2>
          
          {selectedLink ? (
            <>
              {/* Preview Canvas */}
              <div className="qr-preview-container" style={{ position: 'relative' }}>
                {selectedLink.expiresAt && new Date(selectedLink.expiresAt) < new Date() && (
                  <div className="expiry-warning-overlay">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginBottom: '0.5rem' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span>Link & QR Telah Kadaluarsa</span>
                  </div>
                )}
                <div ref={qrRef} className="qr-canvas-wrapper" style={selectedLink.expiresAt && new Date(selectedLink.expiresAt) < new Date() ? { opacity: 0.25, filter: 'grayscale(1)' } : {}}></div>
                <div style={{marginTop: '1rem', textAlign: 'center'}}>
                  <span style={{fontSize: '0.85rem', color: 'var(--text-light)'}}>QR Code untuk alias:</span>
                  <div style={{fontWeight: 700, color: 'var(--kai-orange)', fontSize: '1.05rem'}}>{selectedLink.id}</div>
                </div>
              </div>

              {/* QR Code Controls */}
              <div className="qr-controls">
                <div className="form-group">
                  <label className="form-label">Desain Dot QR</label>
                  <select className="form-input" value={dotType} onChange={(e) => setDotType(e.target.value)}>
                    <option value="rounded">Rounded (Membulat)</option>
                    <option value="dots">Dots (Titik-Titik Lingkaran)</option>
                    <option value="square">Square (Kotak Klasik)</option>
                    <option value="extra-rounded">Extra Rounded</option>
                    <option value="classy">Classy</option>
                    <option value="classy-rounded">Classy Rounded</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem'}}>
                    <input type="checkbox" checked={customCorners} onChange={(e) => setCustomCorners(e.target.checked)} />
                    Kustom Warna & Bentuk Sudut (Eye) Terpisah
                  </label>
                </div>

                {customCorners ? (
                  <div style={{ background: 'rgba(13,58,111,0.03)', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Sudut Luar (Square)</label>
                        <select className="form-input" style={{ padding: '0.5rem' }} value={cornersSquareType} onChange={(e) => setCornersSquareType(e.target.value)}>
                          <option value="rounded">Rounded</option>
                          <option value="square">Square</option>
                          <option value="extra-rounded">Extra Rounded</option>
                          <option value="dot">Dot</option>
                        </select>
                        <input
                          type="color"
                          className="form-input"
                          style={{ height: '35px', padding: '0.1rem', marginTop: '0.3rem' }}
                          value={cornersSquareColor}
                          onChange={(e) => setCornersSquareColor(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Sudut Dalam (Dot)</label>
                        <select className="form-input" style={{ padding: '0.5rem' }} value={cornersDotType} onChange={(e) => setCornersDotType(e.target.value)}>
                          <option value="dot">Dot (Lingkaran)</option>
                          <option value="square">Square (Kotak)</option>
                          <option value="rounded">Rounded</option>
                        </select>
                        <input
                          type="color"
                          className="form-input"
                          style={{ height: '35px', padding: '0.1rem', marginTop: '0.3rem' }}
                          value={cornersDotColor}
                          onChange={(e) => setCornersDotColor(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Desain Sudut QR (Corner)</label>
                    <select className="form-input" value={cornersSquareType} onChange={(e) => {
                      setCornersSquareType(e.target.value);
                      // Samakan cornersDotType agar serasi
                      setCornersDotType(e.target.value === 'square' ? 'square' : 'dot');
                    }}>
                      <option value="rounded">Rounded (Melengkung)</option>
                      <option value="square">Square (Siku Tajam)</option>
                      <option value="dot">Dot (Bulatan)</option>
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Pewarnaan QR Code</label>
                  <div style={{display: 'flex', gap: '1rem', marginBottom: '0.5rem'}}>
                    <label style={{fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer'}}>
                      <input type="radio" checked={qrColorType === 'solid'} onChange={() => setQrColorType('solid')} /> Warna Solid
                    </label>
                    <label style={{fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer'}}>
                      <input type="radio" checked={qrColorType === 'gradient'} onChange={() => setQrColorType('gradient')} /> Gradasi KAI
                    </label>
                  </div>
                  
                  {qrColorType === 'solid' ? (
                    <input
                      type="color"
                      className="form-input"
                      style={{height: '42px', padding: '0.2rem 0.5rem'}}
                      value={qrColorSolid}
                      onChange={(e) => setQrColorSolid(e.target.value)}
                    />
                  ) : (
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <input
                        type="color"
                        className="form-input"
                        style={{height: '42px', padding: '0.2rem 0.5rem', flex: 1}}
                        value={qrColorGradStart}
                        onChange={(e) => setQrColorGradStart(e.target.value)}
                      />
                      <span style={{alignSelf: 'center', color: 'var(--text-light)'}}>ke</span>
                      <input
                        type="color"
                        className="form-input"
                        style={{height: '42px', padding: '0.2rem 0.5rem', flex: 1}}
                        value={qrColorGradEnd}
                        onChange={(e) => setQrColorGradEnd(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem'}}>
                    <input type="checkbox" checked={hasLogo} onChange={(e) => setHasLogo(e.target.checked)} />
                    Pasang Logo Resmi KAI di Tengah QR
                  </label>
                </div>

                {/* Download & Poster Group */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  <div className="qr-download-group">
                    <button onClick={() => downloadQR('png')} className="btn btn-outline">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      Download PNG
                    </button>
                    <button onClick={() => downloadQR('svg')} className="btn btn-secondary">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      Download SVG
                    </button>
                  </div>
                  
                  <button onClick={() => setShowPosterModal(true)} className="btn" style={{ background: 'linear-gradient(135deg, var(--kai-blue), #1e40af)', color: 'white', width: '100%', boxShadow: '0 4px 12px rgba(13, 58, 111, 0.15)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    Buat Poster Cetak Stasiun (A4)
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{margin: 'auto 0'}}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom: '1rem', opacity: 0.6}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <h3>Belum Ada Link Terpilih</h3>
              <p>Perpendek URL baru di sebelah kiri atau pilih salah satu link di riwayat tabel bawah untuk mulai mendesain QR Code dengan Logo KAI.</p>
            </div>
          )}
        </div>
      </div>

      {/* DASHBOARD ANALYTICS (GRAFIK) */}
      <div className="card analytics-card">
        <div className="analytics-header">
          <h2 className="analytics-header-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            Dashboard Analytics {selectedLink ? `- Link [${selectedLink.id}]` : '(Akumulatif)'}
          </h2>
          {selectedLink && (
            <button onClick={() => setSelectedLink(null)} className="btn btn-outline btn-sm">
              Tampilkan Semua Akumulatif
            </button>
          )}
        </div>
        <div className="analytics-grid">
          <div className="analytics-stats-column">
            <div className="analytics-stat-box">
              <span className="analytics-stat-label">Total Link Aktif</span>
              <span className="analytics-stat-value">{links.length}</span>
              <span className="analytics-stat-desc">Jumlah link pendek terdaftar di sistem</span>
            </div>
            
            <div className="analytics-stat-box">
              <span className="analytics-stat-label">
                {selectedLink ? 'Klik pada Link Terpilih' : 'Total Scan & Klik (Semua)'}
              </span>
              <span className="analytics-stat-value" style={{ color: 'var(--kai-blue)' }}>
                {selectedLink ? selectedLink.clicks : totalClicksAll}
              </span>
              <span className="analytics-stat-desc">
                {selectedLink ? `Mengarah ke: ${selectedLink.longUrl.substring(0,35)}...` : 'Akumulasi seluruh pemindaian QR'}
              </span>
            </div>

            {mostPopularLink && !selectedLink && (
              <div className="analytics-stat-box" style={{ borderLeft: '4px solid var(--kai-orange)' }}>
                <span className="analytics-stat-label">Link Terpopuler</span>
                <span className="analytics-stat-value" style={{ fontSize: '1.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mostPopularLink.id}
                </span>
                <span className="analytics-stat-desc">Dengan total {mostPopularLink.clicks} klik pemindaian</span>
              </div>
            )}
          </div>
          
          <div className="chart-container">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* SEKSI RIWAYAT LINK */}
      <div className="card table-card">
        <div className="table-header-container">
          <h2>Daftar Link & Statistik Tracking</h2>
          <button onClick={fetchLinks} className="btn btn-outline btn-sm" style={{display: 'inline-flex', gap: '0.25rem'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            Refresh Data
          </button>
        </div>

        {/* Tabel Controls (Search, Filter, Sort) */}
        <div className="table-controls">
          <div className="search-wrapper">
            <svg className="search-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              placeholder="Cari berdasarkan alias atau URL asli..." 
              className="form-input search-input-field"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedLinkIds([]); // Clear selection when search changes
              }}
            />
          </div>

          <div className="filter-group">
            <select className="filter-select" value={filterType} onChange={(e) => { setFilterType(e.target.value); setSelectedLinkIds([]); }}>
              <option value="all">Semua Link</option>
              <option value="popular">Populer (&gt;= 10 Klik)</option>
              <option value="unclicked">Belum Ada Klik</option>
            </select>

            <select className="filter-select" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setSelectedLinkIds([]); }}>
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
              <option value="clicks_desc">Scan Terbanyak</option>
              <option value="clicks_asc">Scan Tersedikit</option>
            </select>
          </div>
        </div>

        {/* Batch Action Bar */}
        {selectedLinkIds.length > 0 && (
          <div className="batch-action-bar">
            <div className="batch-text">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              {selectedLinkIds.length} item link terpilih untuk diekspor
            </div>
            <div className="batch-buttons">
              <button onClick={handleBatchDownload} disabled={isZipping} className="btn batch-btn-download">
                {isZipping ? (
                  <>
                    <span className="spinner" style={{ width: '14px', height: '14px', borderLeftColor: 'white' }}></span> Mengompresi...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Unduh Semua QR Terpilih (.zip)
                  </>
                )}
              </button>
              <button onClick={() => setSelectedLinkIds([])} className="btn batch-btn-cancel">
                Batalkan
              </button>
            </div>
          </div>
        )}

        {processedLinks.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input 
                      type="checkbox" 
                      className="custom-checkbox"
                      onChange={handleSelectAll}
                      checked={selectedLinkIds.length === processedLinks.length && processedLinks.length > 0}
                    />
                  </th>
                  <th>Alias / Link Pendek</th>
                  <th>URL Tujuan Asli</th>
                  <th>Tanggal Dibuat</th>
                  <th>Masa Aktif</th>
                  <th>Klik/Pindai</th>
                  <th style={{textAlign: 'center'}}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {processedLinks.map((link) => (
                  <tr key={link.id} style={selectedLink && selectedLink.id === link.id ? {backgroundColor: 'rgba(13, 58, 111, 0.04)'} : {}}>
                    <td className="checkbox-cell">
                      <input 
                        type="checkbox"
                        className="custom-checkbox"
                        checked={selectedLinkIds.includes(link.id)}
                        onChange={() => handleSelectLink(link.id)}
                      />
                    </td>
                    <td>
                      <a
                        href={link.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="short-link-cell"
                      >
                        {link.shortUrl ? link.shortUrl.replace(/^https?:\/\//, '') : `${domainPrefix}${link.id}`}
                      </a>
                    </td>
                    <td>
                      <div className="long-link-cell" title={link.longUrl}>
                        {link.longUrl}
                      </div>
                    </td>
                    <td style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>
                      {new Date(link.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td>
                      {(() => {
                        if (!link.expiresAt) {
                          return <span className="badge-expiry forever">Selamanya</span>;
                        }
                        const isExpired = new Date(link.expiresAt) < new Date();
                        const formattedDate = new Date(link.expiresAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        return isExpired ? (
                          <span className="badge-expiry expired" title={`Kadaluarsa pada ${formattedDate}`}>Kadaluarsa</span>
                        ) : (
                          <span className="badge-expiry active-limited" title={`Kadaluarsa pada ${formattedDate}`}>s.d. {formattedDate}</span>
                        );
                      })()}
                    </td>
                    <td>
                      <span className="badge-clicks">
                        {link.clicks} Click
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons" style={{justifyContent: 'center'}}>
                        <button
                          onClick={() => setSelectedLink(link)}
                          className="btn btn-outline btn-sm"
                          style={selectedLink && selectedLink.id === link.id ? {background: 'var(--kai-blue)', color: 'white', borderColor: 'var(--kai-blue)'} : {}}
                        >
                          Desain QR
                        </button>
                        <button
                          onClick={() => copyToClipboard(link.shortUrl)}
                          className="btn btn-outline btn-sm"
                        >
                          Salin
                        </button>
                        <button
                          onClick={() => handleDelete(link.id)}
                          className="btn btn-outline btn-sm btn-delete"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" strokeWidth="1.5" style={{marginBottom: '1rem', opacity: 0.5}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <h3>Tidak Ada Link Ditemukan</h3>
            <p>Silakan buat link pendek baru atau sesuaikan filter pencarian Anda.</p>
          </div>
        )}
      </div>

      {/* POSTER GENERATOR MODAL */}
      {showPosterModal && selectedLink && (
        <div className="modal-overlay" onClick={() => setShowPosterModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Poster & Card Generator Stasiun KAI</span>
              <button className="modal-close-btn" onClick={() => setShowPosterModal(false)}>
                &times;
              </button>
            </div>
            
            <div className="modal-body">
              {/* KOLOM KIRI: EDIT DATA POSTER */}
              <div className="modal-sidebar">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-dark)' }}>Pengaturan Konten Poster</h3>
                
                <div className="form-group">
                  <label className="form-label">Pilih Tema Desain</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={() => setPosterTheme('blue')} 
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1, backgroundColor: posterTheme === 'blue' ? 'var(--kai-blue)' : '', color: posterTheme === 'blue' ? 'white' : '' }}
                    >
                      KAI Blue
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setPosterTheme('orange')} 
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1, backgroundColor: posterTheme === 'orange' ? 'var(--kai-orange)' : '', color: posterTheme === 'orange' ? 'white' : '' }}
                    >
                      KAI Orange
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setPosterTheme('eco')} 
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1, backgroundColor: posterTheme === 'eco' ? '#1e293b' : '', color: posterTheme === 'eco' ? 'white' : '' }}
                    >
                      Eco Print
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="poster-title">Judul Utama Poster</label>
                  <input
                    id="poster-title"
                    type="text"
                    className="form-input"
                    value={posterTitle}
                    onChange={(e) => setPosterTitle(e.target.value)}
                    placeholder="misal: Pindai di Sini untuk Jadwal KA"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="poster-subtitle">Petunjuk / Sub-judul</label>
                  <input
                    id="poster-subtitle"
                    type="text"
                    className="form-input"
                    value={posterSubtitle}
                    onChange={(e) => setPosterSubtitle(e.target.value)}
                    placeholder="misal: Gunakan kamera atau aplikasi Access"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="poster-station">Nama Stasiun</label>
                  <input
                    id="poster-station"
                    type="text"
                    className="form-input"
                    value={posterStation}
                    onChange={(e) => setPosterStation(e.target.value)}
                    placeholder="misal: Stasiun Gambir"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto', paddingTop: '1rem' }}>
                  <button 
                    type="button" 
                    onClick={handleDownloadPosterPng} 
                    disabled={generatingPosterPng}
                    className="btn btn-primary"
                  >
                    {generatingPosterPng ? (
                      <>
                        <span className="spinner" style={{ width: '16px', height: '16px', borderLeftColor: 'white' }}></span> Mengunduh PNG...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Unduh Poster (PNG)
                      </>
                    )}
                  </button>
                  <button type="button" onClick={handlePrintPoster} className="btn btn-secondary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Cetak Poster (PDF / A4)
                  </button>
                </div>
              </div>

              {/* KOLOM KANAN: LIVE PREVIEW POSTER */}
              <div className="modal-preview-panel">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600 }}>PREVIEW CETAK A4</span>
                
                {/* Poster Element */}
                <div className={`poster-a4-template poster-theme-${posterTheme}`}>
                  <div className="poster-header">
                    <img src={kaiLogo} alt="KAI Logo" className="poster-logo" />
                    <div className="poster-header-text">Pindai di Sini</div>
                  </div>
                  <div className="poster-qr-container">
                    <div className="poster-qr-box">
                      {posterQrImgUrl ? (
                        <img src={posterQrImgUrl} alt="QR Preview" style={{ width: '190px', height: '190px' }} />
                      ) : (
                        <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
                      )}
                    </div>
                  </div>
                  <div className="poster-footer">
                    <div className="poster-title-text">{posterTitle || 'Pindai di Sini'}</div>
                    <div className="poster-subtitle-text">{posterSubtitle || 'Arahkan kamera ponsel Anda'}</div>
                    <div className="poster-station-badge">{posterStation || 'Stasiun KAI'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY POSTER TARGET */}
      {selectedLink && (
        <div id="printable-poster" className={`poster-a4-template poster-theme-${posterTheme}`} style={{ display: 'none' }}>
          <div className="poster-header">
            <img src={kaiLogo} alt="KAI Logo" className="poster-logo" />
            <div className="poster-header-text">Pindai di Sini</div>
          </div>
          <div className="poster-qr-container">
            <div className="poster-qr-box">
              {posterQrImgUrl && (
                <img src={posterQrImgUrl} alt="QR Code Cetak" />
              )}
            </div>
          </div>
          <div className="poster-footer">
            <div className="poster-title-text">{posterTitle}</div>
            <div className="poster-subtitle-text">{posterSubtitle}</div>
            <div className="poster-station-badge">{posterStation}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

