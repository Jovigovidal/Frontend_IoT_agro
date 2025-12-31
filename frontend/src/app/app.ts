import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ViewChild, ChangeDetectorRef } from '@angular/core';
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
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  
  isBrowser: boolean = false;
  intervalo: any;
  conectado: boolean = false; // Se calculará según la última fecha de actualización

  // 1. ESTADO DEL SISTEMA (Botones, Modo, Configuración)
  // Adaptado a la nueva estructura de Laravel (r1, r2, fan_cmd...)
  estado: any = {
    modo: 'AUTO',
    r1: false, r2: false, r3: false, r4: false,
    fan_cmd: 0,
    r1_en: true, r2_en: true, r3_en: true, r4_en: true,
    iniciar_llenado: false, meta_litros: 0
  };

  // 2. DATOS DE SENSORES
  sensorData: any = {
    temp_aire: 0, hum_aire: 0, pres: 0,
    temp_agua: 0, ph: 0, tds: 0,
    box_temp: 0, llenando: false, volumen_actual_ml: 0
  };

  // 3. HISTORIAL Y BITÁCORA
  mediciones: any[] = [];
  logs: any[] = [];
  filtroInicio: string = '';
  filtroFin: string = '';

  // 4. GRÁFICOS
  variableGrafico: string = 'temp_agua'; 
  
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [{
      data: [], label: 'Cargando...', fill: true, tension: 0.4,
      borderColor: '#4db8ff', backgroundColor: 'rgba(77, 184, 255, 0.2)',
      pointBackgroundColor: '#fff', pointBorderColor: '#4db8ff'
    }]
  };

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true, maintainAspectRatio: false, animation: false, 
    interaction: { mode: 'index', intersect: false },
    scales: { x: { display: false }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#ccc' } } },
    plugins: { legend: { labels: { color: '#ccc' } } }
  };

  constructor(
    private api: ApiService,
    private cd: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    Chart.register(...registerables);
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      console.log('🚀 Dashboard Iniciado');
      this.cargarTodo();
      
      // Actualización en vivo cada 2 segundos
      this.intervalo = setInterval(() => { 
        this.cargarEnVivo(); 
      }, 2000);
    }
  }

  ngOnDestroy() { if (this.intervalo) clearInterval(this.intervalo); }

  // ==========================================
  // CARGA DE DATOS
  // ==========================================
  cargarTodo() {
    this.cargarEnVivo();
    this.cargarHistorial();
    this.cargarBitacora();
  }

  cargarEnVivo() {
    this.api.obtenerDashboard().subscribe((resp: any) => {
      if(resp.estado_actual) this.procesarEstado(resp.estado_actual);
      if(resp.ultima_medicion) this.procesarSensores(resp.ultima_medicion);
    });
  }

  procesarEstado(data: any) {
    // Actualizamos el objeto estado con lo que viene de BD
    this.estado = { ...this.estado, ...data };
    this.cd.detectChanges();
  }

  procesarSensores(data: any) {
    this.sensorData = data;
    
    // Cálculo de "Conectado": Si el dato es de hace menos de 20 seg
    if (data.created_at) {
      const diff = (new Date().getTime() - new Date(data.created_at).getTime()) / 1000;
      this.conectado = diff < 20; 
    }

    this.actualizarGraficoLive();
    this.cd.detectChanges();
  }

  // ==========================================
  // CONTROLES (BOTONES)
  // ==========================================

  cambiarModo() {
    const nuevo = this.estado.modo === 'AUTO' ? 'MANUAL' : 'AUTO';
    this.api.enviarComando({ modo: nuevo }).subscribe(() => this.cargarEnVivo());
  }

  toggleRelay(relay: string, valorActual: boolean) {
    if (this.estado.modo === 'AUTO') {
      alert("⚠️ Cambia a MODO MANUAL para controlar esto."); return;
    }
    // Enviar comando invertido (Si estaba true, mandar false)
    const payload = { [relay]: !valorActual };
    this.api.enviarComando(payload).subscribe(() => this.cargarEnVivo());
  }

  toggleFan() {
    if (this.estado.modo === 'AUTO') {
      alert("⚠️ Cambia a MODO MANUAL para controlar el ventilador."); return;
    }
    // Si fan_cmd es 1, mandar 0. Si es 0, mandar 1.
    const nuevo = this.estado.fan_cmd === 1 ? 0 : 1;
    this.api.enviarComando({ fan_cmd: nuevo }).subscribe(() => this.cargarEnVivo());
  }

  controlarLlenado() {
    if (this.estado.iniciar_llenado) {
      this.api.enviarComando({ iniciar_llenado: false }).subscribe(() => this.cargarEnVivo());
    } else {
      const litros = prompt("¿Cuántos litros llenar?", "10");
      if (litros) {
        this.api.enviarComando({ iniciar_llenado: true, meta_litros: parseFloat(litros) }).subscribe(() => this.cargarEnVivo());
      }
    }
  }

  // ==========================================
  // GRÁFICOS Y TABLAS (Sin cambios mayores)
  // ==========================================
  
  cambiarVariableGrafico(v: string) {
    this.variableGrafico = v;
    const meta: any = {
      'temp_agua': { label: 'T. Agua (°C)', color: '#4db8ff' },
      'ph':        { label: 'pH', color: '#00e676' },
      'tds':       { label: 'TDS (ppm)', color: '#ff4d4d' },
      'temp_aire': { label: 'T. Aire (°C)', color: '#ffca28' }
    };
    const cfg = meta[v] || meta['temp_agua'];
    this.lineChartData.datasets[0].label = cfg.label;
    this.lineChartData.datasets[0].borderColor = cfg.color;
    this.lineChartData.datasets[0].pointBorderColor = cfg.color;
    this.lineChartData.datasets[0].backgroundColor = cfg.color + '33'; 
    this.lineChartData.datasets[0].data = [];
    this.lineChartData.labels = [];
    this.chart?.update();
  }

  actualizarGraficoLive() {
    if (this.filtroInicio) return; 
    const val = this.sensorData[this.variableGrafico];
    const hora = new Date().toLocaleTimeString();
    if (this.lineChartData.labels && this.lineChartData.datasets) {
      this.lineChartData.labels.push(hora);
      this.lineChartData.datasets[0].data.push(val);
      if (this.lineChartData.labels.length > 20) {
        this.lineChartData.labels.shift();
        this.lineChartData.datasets[0].data.shift();
      }
      this.chart?.update();
    }
  }

  cargarHistorial() {
    this.api.obtenerHistorial(this.filtroInicio, this.filtroFin).subscribe((data: any[]) => {
      this.mediciones = data;
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
    this.filtroInicio = ''; this.filtroFin = '';
    this.cargarHistorial();
  }

  getTempColor(t: number): string {
    if (t < 24) return '#4db8ff';
    if (t > 28) return '#ff4d4d';
    return '#00e676';
  }
}