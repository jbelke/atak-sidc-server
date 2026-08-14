{{/*
Expand the name of the chart.
*/}}
{{- define "atak-sidc-server.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Fully qualified app name. Truncated at 63 chars because some Kubernetes name
fields are limited to that (by the DNS naming spec).
*/}}
{{- define "atak-sidc-server.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart name and version as used by the chart label.
*/}}
{{- define "atak-sidc-server.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "atak-sidc-server.labels" -}}
helm.sh/chart: {{ include "atak-sidc-server.chart" . }}
{{ include "atak-sidc-server.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ include "atak-sidc-server.name" . }}
{{- with .Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Selector labels. Immutable on Deployment.spec.selector — never add anything
version-dependent here or upgrades will fail.
*/}}
{{- define "atak-sidc-server.selectorLabels" -}}
app.kubernetes.io/name: {{ include "atak-sidc-server.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Name of the service account to use.
*/}}
{{- define "atak-sidc-server.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "atak-sidc-server.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Container image reference. Tag falls back to the chart's appVersion so a plain
`helm install` always pulls a pinned, known-good tag rather than :latest.
*/}}
{{- define "atak-sidc-server.image" -}}
{{- $registry := .Values.image.registry | default "" -}}
{{- $repository := .Values.image.repository | required "image.repository is required" -}}
{{- $tag := .Values.image.tag | default .Chart.AppVersion -}}
{{- if .Values.image.digest -}}
{{- if $registry -}}{{ printf "%s/%s@%s" $registry $repository .Values.image.digest }}{{- else -}}{{ printf "%s@%s" $repository .Values.image.digest }}{{- end -}}
{{- else -}}
{{- if $registry -}}{{ printf "%s/%s:%s" $registry $repository $tag }}{{- else -}}{{ printf "%s:%s" $repository $tag }}{{- end -}}
{{- end -}}
{{- end }}

{{/*
Ingress host list — a single `ingress.host` is expanded into the same shape as
`ingress.hosts` so simple deployments only have to set one string.
*/}}
{{- define "atak-sidc-server.ingressHosts" -}}
{{- if .Values.ingress.hosts -}}
{{- toYaml .Values.ingress.hosts -}}
{{- else -}}
- host: {{ .Values.ingress.host | quote }}
  paths:
    - path: {{ .Values.ingress.path }}
      pathType: {{ .Values.ingress.pathType }}
{{- end -}}
{{- end }}
