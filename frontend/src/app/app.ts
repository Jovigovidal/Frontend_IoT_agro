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
  umbralesCargados: boolean = false;

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

  // 2. UMBRALES BIOLÓGICOS (Ajustable desde Angular)
  
  configActive: any = { relay: 'r1' };
  relayConfigs: any = {
    r1: { sensor: 'ph', min: null, max: null },
    r2: { sensor: 'temp_agua', min: null, max: null },
    r3: { sensor: 'tds', min: null, max: null },
    r4: { sensor: 'temp_agua', min: null, max: null },
  };

  // 3. DATOS DE SENSORES EN VIVO
  sensorData: any = {
    temp_aire: 0,
    hum_aire: 0,
    presion: 0,
    temp_agua: 0,
    ph: 0,
    tds: 0,
  };

  // 4. HISTORIAL Y BITÁCORA
  mediciones: any[] = [];
  logs: any[] = [];
  filtroInicio: string = '';
  filtroFin: string = '';

  // 5. GRÁFICOS
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
      }, 500);
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
        if (resp.estado_actual) {
          this.estado = { ...this.estado, ...resp.estado_actual };

          // Extraemos los umbrales de Laravel (MySQL) y los pintamos en los inputs
          // Se hace SOLO la primera vez para no sobrescribir mientras el usuario edita
          if (!this.umbralesCargados) {
            if (resp.estado_actual.r1_sensor) {
              this.relayConfigs.r1.sensor = resp.estado_actual.r1_sensor;
              this.relayConfigs.r1.min = resp.estado_actual.r1_min;
              this.relayConfigs.r1.max = resp.estado_actual.r1_max;
            }
            if (resp.estado_actual.r2_sensor) {
              this.relayConfigs.r2.sensor = resp.estado_actual.r2_sensor;
              this.relayConfigs.r2.min = resp.estado_actual.r2_min;
              this.relayConfigs.r2.max = resp.estado_actual.r2_max;
            }
            this.umbralesCargados = true;
          }
        }

        if (resp.ultima_medicion) {
          this.procesarSensores(resp.ultima_medicion);
        }
        this.cd.detectChanges();
      },
      error: (err) => {
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

      if (fechaFormateada.indexOf('T') === -1) {
        fechaFormateada = fechaFormateada.replace(' ', 'T');
      }

      if (!fechaFormateada.endsWith('Z')) {
        fechaFormateada += 'Z';
      }

      const fechaBD = new Date(fechaFormateada).getTime();
      const fechaActual = new Date().getTime();
      const diff = Math.abs(fechaActual - fechaBD) / 1000;

      this.conectado = diff < 60;
    }

    if (!this.filtroInicio) {
      this.actualizarGraficoLive();
    }
    this.cd.detectChanges();
  }

  // ==========================================
  // CONTROLES DE ACTUADORES
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

  // ==========================================
  // 🛡️ PARÁMETROS DE BIOSEGURIDAD
  // ==========================================
  cargarConfigRelay() {
    // Al cambiar la pestaña (R1 o R2), forzamos actualización visual
    this.cd.detectChanges();
  }


  cambiarSensor() {
    const relay = this.configActive.relay;
    const sensor = this.relayConfigs[relay].sensor;

    // Vaciamos los valores para obligar al usuario a colocar nuevos
    this.relayConfigs[relay].min = null;
    this.relayConfigs[relay].max = null;

    this.cd.detectChanges();
  }
  
  guardarUmbrales() {
    // 1. Validar que no haya campos nulos o vacíos
    if (this.relayConfigs.r1.min === null || this.relayConfigs.r1.max === null ||
        this.relayConfigs.r2.min === null || this.relayConfigs.r2.max === null) {
      alert('⚠️ Por favor, ingresa todos los valores de los umbrales antes de guardar.');
      return;
    }

    // 2. Validar coherencia lógica (min debe ser menor que max)
    if (this.relayConfigs.r1.min >= this.relayConfigs.r1.max ||
        this.relayConfigs.r2.min >= this.relayConfigs.r2.max) {
      alert('⚠️ Error: El valor mínimo debe ser menor que el valor máximo.');
      return;
    }

    // Construimos el objeto EXACTO que AcuarioController y la base de datos esperan
    const payload = {
      r1_sensor: this.relayConfigs.r1.sensor,
      r1_min: Number(this.relayConfigs.r1.min),
      r1_max: Number(this.relayConfigs.r1.max),
      
      r2_sensor: this.relayConfigs.r2.sensor,
      r2_min: Number(this.relayConfigs.r2.min),
      r2_max: Number(this.relayConfigs.r2.max)
    };
  
    this.api.enviarComando(payload).subscribe({
      next: (res: any) => {
        console.log('Parámetros de Bioseguridad guardados', res);
        // (Opcional) Mostrar una alerta o notificación de éxito
        alert('Parámetros aplicados correctamente al sistema.');
      },
      error: (err) => {
        console.error('Error al guardar los umbrales', err);
      }
    });
  }
  
  cargarDatosDashboard() {
    this.api.obtenerDashboard().subscribe((data: any) => {
      this.estado = data?.estado_actual || this.estado;
      
      // IMPORTANTE: Alimentar relayConfigs con lo que viene de la base de datos
      if (this.estado && !this.umbralesCargados) {
        this.relayConfigs.r1.sensor = this.estado.r1_sensor || 'ph';
        this.relayConfigs.r1.min = this.estado.r1_min || null;
        this.relayConfigs.r1.max = this.estado.r1_max || null;
  
        this.relayConfigs.r2.sensor = this.estado.r2_sensor || 'temp_agua';
        this.relayConfigs.r2.min = this.estado.r2_min || null;
        this.relayConfigs.r2.max = this.estado.r2_max || null;
        this.umbralesCargados = true;
      }
    });
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
