import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './services/api';

// --- CHART.JS ---
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, Chart, registerables } from 'chart.js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  isBrowser: boolean = false;
  intervalo: any;
  conectado: boolean = false;
  isMobile: boolean = false;

  // 1. ESTADO DEL SISTEMA
  estado: any = {
    modo: 'AUTO',
    r1: false,
    r2: false,
    r3: false,
    r4: false,
    fan_cmd: 0,
    r1_en: true,
    r2_en: true,
    r3_en: true,
    r4_en: true,
    box_temp: 0,
    box_hum: 0,
  };

  // 2. CONFIGURACIÓN DINÁMICA DE CICLOS
  config: any = { intervalo_reles: 3 };

  // 3. UMBRALES BIOLÓGICOS
  configActive: any = { relay: 'r1' };
  relayConfigs: any = {
    r1: { sensor: 'ph', min: 6.5, max: 8.5 },
    r2: { sensor: 'temp_agua', min: 24.0, max: 28.0 },
    r3: { sensor: 'tds', min: 100, max: 500 },
    r4: { sensor: 'temp_agua', min: 24.0, max: 28.0 },
  };

  // 4. DATOS DE SENSORES
  sensorData: any = {
    temp_aire: 0,
    hum_aire: 0,
    presion: 0,
    temp_agua: 0,
    ph: 0,
    tds: 0,
  };

  // 5. HISTORIAL Y BITÁCORA
  mediciones: any[] = [];
  logs: any[] = [];
  filtroInicio: string = '';
  filtroFin: string = '';

  // 6. GRÁFICOS
  variableGrafico: string = 'temp_agua';

  public lineChartData: ChartConfiguration<any>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'T. Agua (°C)',
        backgroundColor: 'rgba(88, 166, 255, 0.6)',
        borderColor: '#58a6ff',
        borderWidth: 1,
        borderRadius: 5,
      },
    ],
  };

  public lineChartOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: { color: '#8b949e', font: { size: 10, weight: 'bold' } },
      },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e' } },
    },
    plugins: {
      legend: { labels: { color: '#c9d1d9' } },
      tooltip: { backgroundColor: '#161b22', titleColor: '#58a6ff' },
    },
  };

  @HostListener('window:resize')
  onResize() {
    if (this.isBrowser) {
      this.isMobile = window.innerWidth <= 768;
      this.chart?.update();
    }
  }

  constructor(
    private api: ApiService,
    private cd: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    Chart.register(...registerables);
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      console.log('🚀 Dashboard Ebenezer v7 Iniciado (Esperando DOM...)');
    }
  }

  ngAfterViewInit() {
    if (this.isBrowser) {
      this.isMobile = window.innerWidth <= 768;
      setTimeout(() => {
        console.log('✅ DOM listo, iniciando peticiones a Laravel...');
        this.cargarTodo();
        this.intervalo = setInterval(() => {
          this.cargarEnVivo();
        }, 2000);
      }, 500); // Retraso de seguridad para evitar error cssRules
    }
  }

  ngOnDestroy() {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  // ==========================================
  // CARGA DE DATOS Y DIAGNÓSTICO
  // ==========================================
  cargarTodo() {
    this.cargarEnVivo();
    this.cargarHistorial();
    this.cargarBitacora();
  }

  cargarEnVivo() {
    this.api.obtenerDashboard().subscribe({
      next: (resp: any) => {
        console.log('📦 Respuesta de Laravel:', resp); // Veremos qué llega exactamente

        if (resp.estado_actual) {
          this.estado = { ...this.estado, ...resp.estado_actual };
          if (resp.estado_actual.intervalo_reles)
            this.config.intervalo_reles = resp.estado_actual.intervalo_reles;
          if (resp.estado_actual.triggers)
            this.relayConfigs = { ...this.relayConfigs, ...resp.estado_actual.triggers };
        }

        if (resp.ultima_medicion) {
          this.procesarSensores(resp.ultima_medicion);
        } else {
          console.warn('⚠️ Laravel respondió, pero faltan los datos de ultima_medicion');
        }
        this.cd.detectChanges();
      },
      error: (err) => {
        // ¡Si Zrok, CORS o Laravel fallan, esto nos dirá por qué!
        console.error('❌ ERROR DE RED O SERVIDOR:', err);
        this.conectado = false;
        this.cd.detectChanges();
      },
    });
  }

  procesarSensores(data: any) {
    this.sensorData = data;
    
    if (data && data.created_at) {
      let fechaFormateada = data.created_at;
      
      // Convertimos el formato de Laravel a ISO estándar
      if (fechaFormateada.indexOf('T') === -1) {
        fechaFormateada = fechaFormateada.replace(' ', 'T');
      }

      // 🕒 EL TRUCO PARA PERÚ: Añadimos 'Z' para indicar que es UTC
      // Tu navegador lo convertirá automáticamente restando las 5 horas.
      if (!fechaFormateada.endsWith('Z')) {
        fechaFormateada += 'Z';
      }

      const fechaBD = new Date(fechaFormateada).getTime();
      const fechaActual = new Date().getTime();
      
      // Calculamos la diferencia absoluta
      const diff = Math.abs(fechaActual - fechaBD) / 1000;

      // ✅ AHORA SÍ: Si la diferencia es menor a 60 segundos, estamos ONLINE
      this.conectado = diff < 60; 

      console.log(`⏱️ Sync: ${diff.toFixed(2)}s | Estado: ${this.conectado ? 'ONLINE' : 'OFFLINE'}`);
    }
    
    if (!this.filtroInicio) {
      this.actualizarGraficoLive();
    }
    this.cd.detectChanges();
  }

  // ==========================================
  // CONTROLES Y CONFIGURACIÓN BIOLÓGICA
  // ==========================================
  cambiarModo() {
    const nuevo = this.estado.modo === 'AUTO' ? 'MANUAL' : 'AUTO';
    this.api.enviarComando({ modo: nuevo }).subscribe(() => this.cargarEnVivo());
  }

  toggleRelay(relay: string, valorActual: boolean) {
    if (this.estado.modo === 'AUTO') {
      alert('⚠️ Cambia a MODO MANUAL para controlar relés.');
      return;
    }
    this.api.enviarComando({ [relay]: !valorActual }).subscribe(() => this.cargarEnVivo());
  }

  toggleFan() {
    if (this.estado.modo === 'AUTO') {
      alert('⚠️ Cambia a MODO MANUAL para el ventilador.');
      return;
    }
    const nuevo = this.estado.fan_cmd === 1 ? 0 : 1;
    this.api.enviarComando({ fan_state: nuevo }).subscribe(() => this.cargarEnVivo());
  }

  guardarConfiguracion() {
    this.api.enviarComando({ intervalo_reles: this.config.intervalo_reles }).subscribe();
  }

  cargarConfigRelay() {
    this.cd.detectChanges();
  }

  guardarUmbrales() {
    this.api
      .enviarComando({ triggers: this.relayConfigs, active_relay_config: this.configActive.relay })
      .subscribe();
  }

  actualizarCalculo() {
    this.cd.detectChanges();
  }

  // ==========================================
  // 📊 LÓGICA DE GRÁFICOS
  // ==========================================
  cambiarVariableGrafico(v: string) {
    this.variableGrafico = v;
    const meta: any = {
      temp_agua: { label: 'T. Agua (°C)', color: '#58a6ff' },
      ph: { label: 'pH', color: '#3fb950' },
      tds: { label: 'TDS (ppm)', color: '#bc8cff' },
      temp_aire: { label: 'T. Aire (°C)', color: '#e3b341' },
    };
    const cfg = meta[v] || meta['temp_agua'];

    this.lineChartData.datasets[0].label = this.filtroInicio
      ? `Media Diaria ${cfg.label}`
      : cfg.label;
    this.lineChartData.datasets[0].borderColor = cfg.color;
    this.lineChartData.datasets[0].backgroundColor = cfg.color + '99';

    if (this.filtroInicio) this.procesarDatosHistoricos(v);
    else {
      this.lineChartData.labels = [];
      this.lineChartData.datasets[0].data = [];
    }
    this.chart?.update();
  }

  actualizarGraficoLive() {
    const val = this.sensorData[this.variableGrafico];
    const hora = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (this.lineChartData.labels && this.lineChartData.datasets) {
      this.lineChartData.labels.push(hora);
      this.lineChartData.datasets[0].data.push(val);
      if (this.lineChartData.labels.length > 15) {
        this.lineChartData.labels.shift();
        this.lineChartData.datasets[0].data.shift();
      }
      this.chart?.update();
    }
  }

  procesarDatosHistoricos(variable: string) {
    if (!this.mediciones || this.mediciones.length === 0) return;
    const diasSemana = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const agrupado: any = {};

    this.mediciones.forEach((m) => {
      if (m.created_at) {
        const d = new Date(m.created_at);
        const fechaKey = m.created_at.substring(0, 10);
        const val = parseFloat(m[variable]);

        if (!isNaN(val)) {
          if (!agrupado[fechaKey]) agrupado[fechaKey] = { suma: 0, count: 0, dia: d.getDay() };
          agrupado[fechaKey].suma += val;
          agrupado[fechaKey].count++;
        }
      }
    });

    const labelsX: any[] = [];
    const dataY: number[] = [];

    Object.keys(agrupado)
      .sort()
      .forEach((fecha) => {
        const promedio = agrupado[fecha].suma / agrupado[fecha].count;
        labelsX.push([diasSemana[agrupado[fecha].dia], fecha.split('-').reverse().join('/')]);
        dataY.push(parseFloat(promedio.toFixed(2)));
      });

    this.lineChartData.labels = labelsX;
    this.lineChartData.datasets[0].data = dataY;
    this.chart?.update();
  }

  // ==========================================
  // HISTORIAL Y BITÁCORA
  // ==========================================
  cargarHistorial() {
    this.api.obtenerHistorial(this.filtroInicio, this.filtroFin).subscribe((data: any[]) => {
      this.mediciones = data;
      if (this.filtroInicio) this.procesarDatosHistoricos(this.variableGrafico);
      this.cd.detectChanges();
    });
  }

  cargarBitacora() {
    this.api.obtenerBitacora().subscribe((data: any[]) => {
      this.logs = data;
      this.cd.detectChanges();
    });
  }

  limpiarFiltro() {
    this.filtroInicio = '';
    this.filtroFin = '';
    this.lineChartData.labels = [];
    this.lineChartData.datasets[0].data = [];
    this.cargarHistorial();
  }

  getTempColor(t: number): string {
    if (t < 24) return '#58a6ff';
    if (t > 28) return '#ff7b72';
    return '#3fb950';
  }
}
