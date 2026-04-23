import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ChangeDetectorRef,
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
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  isBrowser: boolean = false;
  intervalo: any;
  conectado: boolean = false;

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

  sensorData: any = {
    temp_aire: 0,
    hum_aire: 0,
    presion: 0, 
    temp_agua: 0,
    ph: 0,
    tds: 0,
  };

  mediciones: any[] = [];
  logs: any[] = [];
  filtroInicio: string = '';
  filtroFin: string = '';
  variableGrafico: string = 'temp_agua';

  // Configuración de Datos del Gráfico (Tipo 'bar' por defecto)
  public lineChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'T. Agua (°C)',
        backgroundColor: 'rgba(88, 166, 255, 0.6)',
        borderColor: '#58a6ff',
        borderWidth: 1,
        borderRadius: 5, // Barras redondeadas
      },
    ],
  };

  public lineChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { 
        display: true, 
        grid: { display: false }, 
        ticks: { 
          color: '#8b949e',
          font: { size: 10, weight: 'bold' }
        } 
      },
      y: { 
        grid: { color: 'rgba(255,255,255,0.05)' }, 
        ticks: { color: '#8b949e' } 
      },
    },
    plugins: { 
      legend: { labels: { color: '#c9d1d9' } },
      tooltip: { backgroundColor: '#161b22', titleColor: '#58a6ff' }
    },
  };

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
      console.log('🚀 Ebenezer IoT v7 - Análisis Histórico Activado');
      this.cargarTodo();
      this.intervalo = setInterval(() => this.cargarEnVivo(), 2000);
    }
  }

  ngOnDestroy() {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  cargarTodo() {
    this.cargarEnVivo();
    this.cargarHistorial();
    this.cargarBitacora();
  }

  cargarEnVivo() {
    this.api.obtenerDashboard().subscribe((resp: any) => {
      if (resp.estado_actual) this.estado = { ...this.estado, ...resp.estado_actual };
      if (resp.ultima_medicion) {
        this.sensorData = resp.ultima_medicion;
        const diff = (new Date().getTime() - new Date(this.sensorData.created_at).getTime()) / 1000;
        this.conectado = diff < 20;
        if (!this.filtroInicio) this.actualizarGraficoLive();
      }
      this.cd.detectChanges();
    });
  }

  // ==========================================
  // 📊 LÓGICA DE PROMEDIOS DIARIOS (HISTÓRICO)
  // ==========================================
  procesarDatosHistoricos(variable: string) {
    if (!this.mediciones || this.mediciones.length === 0) return;

    const diasSemana = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const agrupado: any = {};

    this.mediciones.forEach(m => {
      const d = new Date(m.created_at);
      const fechaKey = d.toISOString().split('T')[0];
      const val = parseFloat(m[variable]);

      if (!isNaN(val)) {
        if (!agrupado[fechaKey]) agrupado[fechaKey] = { suma: 0, count: 0, dia: d.getDay() };
        agrupado[fechaKey].suma += val;
        agrupado[fechaKey].count++;
      }
    });

    const labelsX: any[] = [];
    const dataY: number[] = [];

    Object.keys(agrupado).sort().forEach(fecha => {
      const promedio = agrupado[fecha].suma / agrupado[fecha].count;
      const nombreDia = diasSemana[agrupado[fecha].dia];
      
      // Creamos una etiqueta de dos líneas: [ "LUNES", "20/04/2026" ]
      const fechaFormateada = fecha.split('-').reverse().join('/');
      labelsX.push([nombreDia, fechaFormateada]); 
      dataY.push(parseFloat(promedio.toFixed(2)));
    });

    this.lineChartData.labels = labelsX;
    this.lineChartData.datasets[0].data = dataY;
    this.chart?.update();
  }

  cambiarVariableGrafico(v: string) {
    this.variableGrafico = v;
    const meta: any = {
      temp_agua: { label: 'Media T. Agua (°C)', color: '#58a6ff' },
      ph:        { label: 'Media pH', color: '#3fb950' },
      tds:       { label: 'Media TDS (ppm)', color: '#bc8cff' },
      temp_aire: { label: 'Media T. Aire (°C)', color: '#e3b341' },
    };
    const cfg = meta[v];
    this.lineChartData.datasets[0].label = cfg.label;
    this.lineChartData.datasets[0].backgroundColor = cfg.color + '99'; // 60% opacidad
    this.lineChartData.datasets[0].borderColor = cfg.color;

    if (this.filtroInicio) {
      this.procesarDatosHistoricos(v);
    } else {
      this.lineChartData.labels = [];
      this.lineChartData.datasets[0].data = [];
    }
    this.chart?.update();
  }

  actualizarGraficoLive() {
    const val = this.sensorData[this.variableGrafico];
    const hora = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
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

  cargarHistorial() {
    this.api.obtenerHistorial(this.filtroInicio, this.filtroFin).subscribe((data: any[]) => {
      this.mediciones = data;
      if (this.filtroInicio) this.procesarDatosHistoricos(this.variableGrafico);
      this.cd.detectChanges();
    });
  }

  // ... (Resto de métodos: Bitacora, Comandos, Limpiar)
  cargarBitacora() { this.api.obtenerBitacora().subscribe(d => this.logs = d); }
  
  cambiarModo() {
    const n = this.estado.modo === 'AUTO' ? 'MANUAL' : 'AUTO';
    this.api.enviarComando({ modo: n }).subscribe(() => this.cargarEnVivo());
  }

  toggleRelay(r: string, v: boolean) {
    if (this.estado.modo === 'AUTO') return alert('⚠️ Usa MODO MANUAL');
    this.api.enviarComando({ [r]: !v }).subscribe(() => this.cargarEnVivo());
  }

  toggleFan() {
    if (this.estado.modo === 'AUTO') return alert('⚠️ Usa MODO MANUAL');
    const n = this.estado.fan_cmd === 1 ? 0 : 1;
    this.api.enviarComando({ fan_state: n }).subscribe(() => this.cargarEnVivo());
  }

  limpiarFiltro() {
    this.filtroInicio = ''; this.filtroFin = '';
    this.lineChartData.labels = []; this.lineChartData.datasets[0].data = [];
    this.cargarHistorial();
  }

  getTempColor(t: number): string {
    if (t < 24) return '#58a6ff';
    if (t > 28) return '#ff7b72';
    return '#3fb950';
  }
}