import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ViewChild, ChangeDetectorRef } from '@angular/core'; // <--- ChangeDetectorRef
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ApiService } from './services/api';

// --- IMPORTACIONES DE CHART.JS ---
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, Chart, registerables } from 'chart.js';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit, OnDestroy {
  mediciones: any[] = [];
  intervalo: any;

  config = {
    modo: 'AUTO',
    relay1: false, relay2: false,
    relay1_enabled: true, relay2_enabled: true
  };

  filtroInicio: string = '';
  filtroFin: string = '';

  sensorData = { temp: 0, hum: 0, pres: 0 };
  isBrowser: boolean = false;

  // --- GRÁFICO ---
  variableGrafico: string = 'temp'; 
  
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Cargando...',
        fill: true,
        tension: 0.4,
        borderColor: '#e74c3c',
        backgroundColor: 'rgba(231, 76, 60, 0.2)'
      }
    ]
  };
  
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // Desactivar animación para evitar errores de renderizado rápido
    interaction: {
      mode: 'index',
      intersect: false,
    },
  };
  
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  constructor(
    private api: ApiService,
    private cd: ChangeDetectorRef, // <--- INYECCIÓN PARA CORREGIR NG0100
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // 1. REGISTRAR COMPONENTES DE CHART.JS (SOLUCIÓN AL ERROR "line is not registered")
    Chart.register(...registerables);

    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.cargarDatos();
      this.intervalo = setInterval(() => { this.cargarDatos(); }, 5000);
    }
  }

  ngOnDestroy() { if (this.intervalo) clearInterval(this.intervalo); }

  cargarDatos() {
    this.api.obtenerMediciones(this.filtroInicio, this.filtroFin).subscribe((data: any) => {
      this.mediciones = data;
      if (data.length > 0) {
        this.sensorData.temp = data[0].temperatura;
        this.sensorData.hum = data[0].humedad;
        this.sensorData.pres = data[0].presion;
        
        if (this.isBrowser) {
             this.actualizarGrafico();
        }
      }
    });

    this.api.obtenerEstadoActual().subscribe((estado: any) => {
        this.config.modo = estado.modo;
        this.config.relay1 = Boolean(Number(estado.relay1_status)); 
        this.config.relay2 = Boolean(Number(estado.relay2_status));
        this.config.relay1_enabled = Boolean(Number(estado.relay1_enabled));
        this.config.relay2_enabled = Boolean(Number(estado.relay2_enabled));
        
        // Forzar detección de cambios para evitar error NG0100
        this.cd.detectChanges();
    });
  }

  cambiarVariableGrafico(tipo: string) {
    this.variableGrafico = tipo;
    this.actualizarGrafico();
  }

  actualizarGrafico() {
    if (!this.mediciones || this.mediciones.length === 0) return;

    const datosOrdenados = [...this.mediciones].reverse();

    // Eje X
    const labels = datosOrdenados.map(d => {
      const date = new Date(d.created_at);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    // Eje Y
    let data: number[] = [];
    let label = '';
    let borderColor = '';
    let backgroundColor = '';

    if (this.variableGrafico === 'temp') {
      data = datosOrdenados.map(d => Number(d.temperatura));
      label = 'Temperatura (°C)';
      borderColor = '#e74c3c';
      backgroundColor = 'rgba(231, 76, 60, 0.2)';
    } else if (this.variableGrafico === 'hum') {
      data = datosOrdenados.map(d => Number(d.humedad));
      label = 'Humedad (%)';
      borderColor = '#3498db';
      backgroundColor = 'rgba(52, 152, 219, 0.2)';
    } else {
      data = datosOrdenados.map(d => Number(d.presion));
      label = 'Presión (hPa)';
      borderColor = '#f39c12';
      backgroundColor = 'rgba(243, 156, 18, 0.2)';
    }

    // Actualizar objeto data completo
    this.lineChartData = {
      labels: labels,
      datasets: [{
        data: data,
        label: label,
        fill: true,
        tension: 0.4,
        borderColor: borderColor,
        backgroundColor: backgroundColor,
        pointBackgroundColor: '#fff',
        pointBorderColor: borderColor,
        pointHoverBackgroundColor: borderColor,
        pointHoverBorderColor: '#fff'
      }]
    };

    // Actualizar el gráfico
    this.chart?.update();
    
    // Forzar actualización de vista Angular
    this.cd.detectChanges();
  }

  // --- CONTROL ---
  cambiarModo() {
    this.config.modo = (this.config.modo === 'AUTO') ? 'MANUAL' : 'AUTO';
    this.guardarCambios();
  }

  toggleRelay(numero: number) {
    if (this.config.modo === 'AUTO') return;
    if (numero === 1 && this.config.relay1_enabled) this.config.relay1 = !this.config.relay1;
    if (numero === 2 && this.config.relay2_enabled) this.config.relay2 = !this.config.relay2;
    this.guardarCambios();
  }
  
  toggleEnable(num: number) {
    if (num === 1) this.config.relay1_enabled = !this.config.relay1_enabled;
    if (num === 2) this.config.relay2_enabled = !this.config.relay2_enabled;
    if (num === 1 && !this.config.relay1_enabled) this.config.relay1 = false;
    if (num === 2 && !this.config.relay2_enabled) this.config.relay2 = false;
    this.guardarCambios();
  }

  guardarCambios() {
    this.api.enviarConfiguracion(this.config).subscribe();
  }

  limpiarFiltro() {
    this.filtroInicio = '';
    this.filtroFin = '';
    this.cargarDatos();
  }
}