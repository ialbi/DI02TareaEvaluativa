import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { environment } from '../../environments/environment';

import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage, IonicModule.forRoot()],
      providers: [
        provideFirebaseApp(() => initializeApp(environment.firebase)),
        provideFirestore(() => getFirestore()),
        AlertController,
        ToastController,
        LoadingController,
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have no data initially', () => {
    expect(component.hayDatos()).toBeFalse();
  });

  it('should filter restaurantes by text', () => {
    component.textoBusqueda.set('test');
    expect(component.restaurantesFiltrados()).toEqual([]);
  });

  it('should clear all filters', () => {
    component.textoBusqueda.set('algo');
    component.territorioSeleccionado.set('Bizkaia');
    component.localidadesSeleccionadas.set(new Set(['Bilbao']));
    component.limpiarTodosFiltros();
    expect(component.textoBusqueda()).toBe('');
    expect(component.territorioSeleccionado()).toBe('');
    expect(component.localidadesSeleccionadas().size).toBe(0);
  });

  it('should remove a single localidad', () => {
    component.localidadesSeleccionadas.set(new Set(['Bilbao', 'Donostia']));
    component.eliminarLocalidad('Bilbao');
    expect(component.localidadesSeleccionadas().has('Bilbao')).toBeFalse();
    expect(component.localidadesSeleccionadas().has('Donostia')).toBeTrue();
  });

  it('should return correct estrellasMichelin array', () => {
    const r: any = { michelinStar: '2' };
    expect(component.estrellasMichelin(r).length).toBe(2);
  });

  it('should return correct repsolSoles array', () => {
    const r: any = { repsolSun: '3' };
    expect(component.repsolSoles(r).length).toBe(3);
  });
});
