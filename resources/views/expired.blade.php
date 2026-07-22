<!doctype html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Kadaluarsa - KAI Link & QR Manager</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --kai-blue: #0D3A6F;
            --kai-orange: #ED6C25;
            --text-dark: #1e293b;
            --text-light: #64748b;
            --bg-color: #f0f3f8;
            --card-bg: rgba(255, 255, 255, 0.9);
            --border-color: #e2e8f0;
            --font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --bg-color: #0b1329;
                --card-bg: #1c2541;
                --text-dark: #f8fafc;
                --text-light: #94a3b8;
                --border-color: #334155;
            }
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--font-sans);
            background-color: var(--bg-color);
            color: var(--text-dark);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            background-image: 
                radial-gradient(at 0% 0%, rgba(237, 108, 37, 0.05) 0px, transparent 50%),
                radial-gradient(at 100% 0%, rgba(13, 58, 111, 0.08) 0px, transparent 50%);
            background-attachment: fixed;
        }

        .container {
            max-width: 480px;
            width: 100%;
            text-align: center;
        }

        .card {
            background: var(--card-bg);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: 16px;
            border: 1px solid var(--border-color);
            box-shadow: 0 10px 30px -5px rgba(13, 58, 111, 0.1), 0 5px 15px -3px rgba(13, 58, 111, 0.05);
            padding: 2.5rem 2rem;
            margin-bottom: 1.5rem;
            transition: transform 0.3s ease;
        }

        .logo-container {
            margin-bottom: 2rem;
        }

        .logo-svg {
            height: 48px;
            width: auto;
        }

        .icon-container {
            width: 80px;
            height: 80px;
            background: rgba(237, 108, 37, 0.1);
            color: var(--kai-orange);
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1.5rem;
        }

        .icon-container svg {
            width: 40px;
            height: 40px;
        }

        h1 {
            font-size: 1.6rem;
            font-weight: 800;
            color: var(--kai-blue);
            margin-bottom: 0.75rem;
            letter-spacing: -0.5px;
        }

        @media (prefers-color-scheme: dark) {
            h1 {
                color: #f8fafc;
            }
        }

        p {
            font-size: 0.95rem;
            color: var(--text-light);
            margin-bottom: 2rem;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.75rem 1.5rem;
            font-size: 0.95rem;
            font-weight: 600;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s ease;
            background: var(--kai-blue);
            color: white;
            box-shadow: 0 4px 10px rgba(13, 58, 111, 0.2);
            width: 100%;
        }

        .btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 14px rgba(13, 58, 111, 0.3);
            background: #08274d;
        }

        .footer {
            font-size: 0.8rem;
            color: var(--text-light);
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="logo-container">
                <!-- Logo KAI Baru Inline SVG -->
                <svg class="logo-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 294.74 124.22">
                    <defs>
                        <style>.cls-1{fill:#2d2a70;}.cls-2{fill:#ed6b23;}</style>
                    </defs>
                    <title>Logo KAI Baru</title>
                    <g id="Layer_2">
                        <g id="Layer_1-2">
                            <path class="cls-1" d="M99.58,124.22h28.56l-6.55-10.77Zm16.67-19.53L86.56,55.91,144.12,0H98.65a13.65,13.65,0,0,0-9.54,3.88L48.79,43.28,53.33,0H12.27L0,116.81a6.71,6.71,0,0,0,6.68,7.42h33.6L43.07,98,55.45,86l21.78,34.43a8.13,8.13,0,0,0,6.87,3.78H99.58l7.81-15.57Z"/>
                            <path class="cls-2" d="M141,124.22l55.61-33.81,7.08,28.71a6.71,6.71,0,0,0,6.52,5.11h36L230.13,70l61.24-37.24.26-2.5-192,93.95Zm83.38-73.65L209.37,0H174a19.52,19.52,0,0,0-17.45,10.77L106,111.37,292,26.52l.29-2.85ZM164.6,74.24,177,48l3.27-7.25a2.23,2.23,0,0,1,4.19.38l5.67,23Z"/>
                            <path class="cls-1" d="M269.53,0a19.52,19.52,0,0,0-19.41,17.49l-2.5,23.88,44.69-17.7L294.74,0Zm-30.6,124.22h43l9.42-91.45L245.6,60.61Z"/>
                        </g>
                    </g>
                </svg>
            </div>
            
            <div class="icon-container">
                <!-- Clock / Expired SVG Icon -->
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636"></path>
                </svg>
            </div>
            
            <h1>Link / QR Code Kadaluarsa</h1>
            <p>Masa aktif akses link pendek ini telah berakhir atau dinonaktifkan. Silakan hubungi pembuat link untuk mendapatkan akses terbaru.</p>
            
            <a href="https://www.kai.id" class="btn">Kembali ke Beranda KAI</a>
        </div>
        
        <div class="footer">
            KAI Link & QR Manager &copy; PT Kereta Api Indonesia (Persero)
        </div>
    </div>
</body>
</html>
