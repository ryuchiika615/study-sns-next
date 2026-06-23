import {
  Chart,
  BarController,
  DoughnutController,
  LineController,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Title,
  Filler,
} from "chart.js";
Chart.register(BarController, DoughnutController, LineController, BarElement, ArcElement, PointElement, LineElement, CategoryScale, LinearScale, Legend, Tooltip, Title, Filler);
export { Chart };
